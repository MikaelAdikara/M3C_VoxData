"""PatchCore-style anomaly model for sealer-bead crops (Roth et al. 2022, simplified).

Image (B,3,96,256) in [0,1] + seam index (B,) -> heatmap (B,1,96,256) and score (B,).
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import ResNet18_Weights, resnet18

N_SEAMS = 16
BANK_SIZE = 1024
SIGMA = 4.0


def gaussian_kernel(sigma: float) -> torch.Tensor:
    r = int(math.ceil(3 * sigma))
    x = torch.arange(-r, r + 1, dtype=torch.float32)
    k = torch.exp(-(x**2) / (2 * sigma**2))
    return k / k.sum()


class PatchCore(nn.Module):
    """Image (B,3,96,256) in [0,1] + seam index (B,) -> heatmap (B,1,96,256), score (B,)."""

    def __init__(self, layers: tuple[int, ...] = (1, 2), proj_dim: int | None = None,
                 bank_size: int = BANK_SIZE, scale: float = 1.0):
        super().__init__()
        self.scale = scale
        net = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1).eval()
        self.layers = tuple(sorted(layers))
        self.stem = nn.Sequential(net.conv1, net.bn1, net.relu, net.maxpool)
        widths = {1: 64, 2: 128, 3: 256}
        self.blocks = nn.ModuleList([net.layer1, net.layer2, net.layer3][: max(self.layers)])
        in_dim = sum(widths[i] for i in self.layers)
        if proj_dim is None:  # keep all channels (the shipped model)
            proj_dim = in_dim
            proj = torch.eye(in_dim).view(in_dim, in_dim, 1, 1)
        else:  # random projection, as in the PatchCore paper's coreset step
            g = torch.Generator().manual_seed(17)
            proj = torch.randn(proj_dim, in_dim, 1, 1, generator=g) / math.sqrt(proj_dim)
        self.use_proj = proj_dim != in_dim or not torch.equal(proj.view(in_dim, -1), torch.eye(in_dim))
        self.register_buffer("proj", proj)
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))
        k = gaussian_kernel(SIGMA)
        self.register_buffer("kx", k.view(1, 1, 1, -1))
        self.register_buffer("ky", k.view(1, 1, -1, 1))
        self.register_buffer("bank", torch.zeros(N_SEAMS, bank_size, proj_dim))
        for prm in self.parameters():
            prm.requires_grad_(False)

    def features(self, img: torch.Tensor) -> torch.Tensor:
        """Locally averaged mid-level features of the chosen layers at the finest layer's grid."""
        x = (img - self.mean) / self.std
        if self.scale != 1.0:
            x = F.interpolate(x, scale_factor=self.scale, mode="bilinear", align_corners=False)
        x = self.stem(x)
        feats = []
        for i, block in enumerate(self.blocks, start=1):
            x = block(x)
            if i in self.layers:
                feats.append(F.avg_pool2d(x, 3, 1, 1))
        size = feats[0].shape[-2:]
        feats = [feats[0]] + [F.interpolate(f, size=size, mode="bilinear", align_corners=False) for f in feats[1:]]
        f = torch.cat(feats, 1)
        return F.conv2d(f, self.proj) if self.use_proj else f  # (B, D, h, w)

    def forward(self, img: torch.Tensor, seam: torch.Tensor):
        f = self.features(img)
        b, dim, h, w = f.shape
        q = f.flatten(2).transpose(1, 2)  # (B, N, D)
        bank = self.bank.index_select(0, seam)  # (B, M, D)
        d2 = (q * q).sum(-1, keepdim=True) - 2 * torch.bmm(q, bank.transpose(1, 2)) + (bank * bank).sum(-1).unsqueeze(1)
        dist = torch.sqrt(torch.clamp(d2.min(-1).values, min=0.0)).view(b, 1, h, w)
        amap = F.interpolate(dist, size=img.shape[-2:], mode="bilinear", align_corners=False)
        r = self.kx.shape[-1] // 2
        amap = F.conv2d(F.pad(amap, (r, r, 0, 0), mode="replicate"), self.kx)
        amap = F.conv2d(F.pad(amap, (0, 0, r, r), mode="replicate"), self.ky)
        score = amap.flatten(1).max(1).values
        return amap, score


def to_tensor(arr, dev) -> torch.Tensor:
    return torch.from_numpy(arr).to(dev).permute(0, 3, 1, 2).float().div_(255.0)


@torch.no_grad()
def greedy_coreset(feats: torch.Tensor, m: int) -> torch.Tensor:
    """k-center greedy subsampling of the patch features (PatchCore section 3.2).
    Squared distances via |f|^2 - 2 f.c + |c|^2: one matrix-vector product per pick."""
    sq = (feats * feats).sum(1)
    idx = torch.empty(m, dtype=torch.long, device=feats.device)
    idx[0] = 0
    mind = sq - 2 * feats @ feats[0] + sq[0]
    for j in range(1, m):
        i = torch.argmax(mind)
        idx[j] = i
        mind = torch.minimum(mind, sq - 2 * feats @ feats[i] + sq[i])
    return feats[idx]
