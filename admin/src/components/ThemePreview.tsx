/**
 * A small sample page drawn with the same `--site-*` custom properties the real blocks read (it must sit inside a
 * `SiteThemeRoot`). Plain markup on purpose: it shows type, colour, corners, spacing and texture, not any block.
 */
function ThemePreview({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div className="tp">
      <header className="tp-header">
        <span className="tp-name">{name || 'Your site'}</span>
        <nav className="tp-nav" aria-hidden="true">
          <span>About</span>
          <span>Services</span>
          <span className="tp-nav-cta">Contact</span>
        </nav>
      </header>

      <section className="tp-hero">
        <h3 className="tp-title">{tagline || 'A headline that sounds like you'}</h3>
        <p className="tp-lede">
          Body copy sits at a comfortable width. <span className="tp-muted">Captions and dates use the quieter secondary text.</span>
        </p>
        <div className="tp-buttons">
          <span className="tp-button">Get in touch</span>
          <span className="tp-button tp-button-quiet">Read more</span>
        </div>
      </section>

      <section className="tp-cards" aria-hidden="true">
        <article className="tp-card">
          <span className="tp-chip">New</span>
          <h4>First panel</h4>
          <p className="tp-muted">Panels lift off the page.</p>
        </article>
        <article className="tp-card">
          <h4>Second panel</h4>
          <p className="tp-muted">Lines mark their edges.</p>
        </article>
      </section>

      <footer className="tp-footer">
        <span className="tp-muted">© {name || 'Your site'}</span>
      </footer>
    </div>
  )
}

export default ThemePreview
