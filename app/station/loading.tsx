export default function StationLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading station">
      <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 24 }} />
      <div className="station">
        <div className="skeleton" style={{ aspectRatio: "16 / 10" }} />
        <div style={{ display: "grid", gap: 16 }}>
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 999 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 999 }} />
        </div>
      </div>
    </main>
  );
}
