# Workflow integration (event outbox + webhook)

The prototype writes every alert, operator decision (yellow andon or rejection), team-leader decision, Kaizen ticket and validated card as one JSON event. The page `/events` lists them. Events are derived from the stored state; actors are roles plus station, never names; notes and images are not included.

## Turn the webhook on

Set in Vercel (Project Settings → Environment Variables), then redeploy:

| Variable | Required | Meaning |
|---|---|---|
| `WORKFLOW_WEBHOOK_URL` | yes | Where new events are POSTed, e.g. the n8n webhook URL |
| `WORKFLOW_WEBHOOK_SECRET` | no | If set, each POST carries `X-Learning-Line-Signature: sha256=<HMAC of the body>` |

Without `WORKFLOW_WEBHOOK_URL` nothing leaves the app and the demo is unchanged. Delivery has a 2.5 s timeout and never blocks or fails a shop-floor action. `/events` has a **Send test event** button.

Body of each POST:

```json
{
  "source": "learning-line-prototype",
  "test": false,
  "events": [
    {
      "id": "andon.yellow:decision-…",
      "type": "andon.yellow",
      "topic": "learning-line/K2-Body/st-04/andon",
      "timestamp": "2027-04-14T08:47:12.000Z",
      "stationId": "st-04",
      "actor": "role:operator@st-04",
      "data": { "alert_id": "…", "body_id": "K2-27-031487", "roi": "seam-R-door-07", "defect_type": "BEAD_BREAK", "decided_by": "role:operator@st-04", "decision": "confirmed" }
    }
  ]
}
```

Event types: `alert.raised`, `andon.yellow`, `alert.rejected`, `decision.team_leader`, `ticket.opened`, `card.validated`.

## Example: yellow andon to a Telegram group (n8n)

`n8n-yellow-andon-telegram.json` is an n8n workflow: Webhook → split events → yellow andon goes to the team-leader group, a new Kaizen ticket goes to the engineer group.

1. Create a Telegram bot with @BotFather and add it to both groups. Get each group's chat ID.
2. In n8n: Workflows → Import from file → choose the JSON. Open both Telegram nodes, create a Telegram credential with the bot token, and replace `REPLACE_WITH_…_CHAT_ID`.
3. Activate the workflow and copy the production webhook URL of the first node into `WORKFLOW_WEBHOOK_URL` in Vercel.
4. Open `/events` → **Send test event**. The team-leader group should get a message.

The team creates the bot, the n8n account and the Vercel variable; none of these are in the repo. The workflow was written against n8n's current node formats (Webhook v2, Split Out v1, Filter v2, Telegram v1.2) but has not been imported into a live n8n instance by us; if a node version differs, re-select the node in n8n and keep the same settings.
