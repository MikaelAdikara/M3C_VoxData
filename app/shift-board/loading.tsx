export default function ShiftBoardLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading shift board">
      <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 24 }} />
      <div className="board">
        <div className="grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 172 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 520 }} />
      </div>
    </main>
  );
}
