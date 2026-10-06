export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 24 }} />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="skeleton" style={{ height: 320 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </main>
  );
}
