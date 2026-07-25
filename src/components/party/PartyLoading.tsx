export function PartyLoading({ message }: { message: string }) {
  return (
    <section className="game-page">
      <div className="party-loading">
        <span className="spinner" aria-hidden="true" />
        <p className="page-subtitle">{message}</p>
      </div>
    </section>
  )
}
