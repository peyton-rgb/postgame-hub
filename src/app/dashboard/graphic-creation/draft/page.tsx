export default function DraftGraphicPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, left: 240, top: 0, background: '#000', zIndex: 40 }}>
      <iframe
        src="/postgame-draft-tool.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Draft Graphic Tool"
      />
    </div>
  )
}
