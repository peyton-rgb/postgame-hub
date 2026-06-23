export default function DraftToolPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }}>
      <iframe
        src="/postgame-draft-tool.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Postgame Draft Tool"
      />
    </div>
  )
}
