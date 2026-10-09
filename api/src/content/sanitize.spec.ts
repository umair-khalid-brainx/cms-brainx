import { sanitizeBlocks, sanitizeRichText } from './sanitize.js';

describe('sanitizeRichText', () => {
  it('keeps everything the editor toolbar can produce', () => {
    const html =
      '<h2>Heading</h2><h3>Sub</h3><p>Some <strong>bold</strong> and <em>italic</em> with a <a href="https://example.com/a?b=1">link</a>.</p>' +
      '<ul><li><p>one</p></li><li>two</li></ul><ol><li>first</li></ol><blockquote><p>quoted</p></blockquote><p>line<br>break</p>';
    expect(sanitizeRichText(html)).toBe(html.replace('<br>', '<br />'));
  });

  it('removes script tags and their contents', () => {
    expect(sanitizeRichText('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });

  it('removes event handlers and inline styles', () => {
    const out = sanitizeRichText('<p onclick="x()" style="color:red" onmouseover="y()">Hi</p>');
    expect(out).toBe('<p>Hi</p>');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ])('drops a link to %j', (href) => {
    // The link goes, the words stay as plain text.
    expect(sanitizeRichText(`<p>see <a href="${href}">x</a></p>`)).toBe('<p>see x</p>');
  });

  it('keeps web, email and same-site links', () => {
    for (const href of ['https://a.com', 'http://a.com', 'mailto:a@b.com', '/about', '#pricing']) {
      expect(sanitizeRichText(`<a href="${href}">x</a>`)).toBe(`<a href="${href}">x</a>`);
    }
  });

  it('drops target, rel and other attributes from links', () => {
    expect(sanitizeRichText('<a href="/a" target="_blank" rel="nofollow" class="x" onclick="y()">x</a>')).toBe(
      '<a href="/a">x</a>',
    );
  });

  it('removes images, iframes, forms and other tags the toolbar cannot make, keeping their text', () => {
    expect(sanitizeRichText('<p>a<img src="x" onerror="alert(1)">b</p>')).toBe('<p>ab</p>');
    expect(sanitizeRichText('<iframe src="https://evil.example"></iframe><p>ok</p>')).toBe('<p>ok</p>');
    expect(sanitizeRichText('<form><input name="x"><button>Go</button></form>')).toBe('Go');
    expect(sanitizeRichText('<h1>Title</h1>')).toBe('Title');
  });

  it('turns <b> and <i> into <strong> and <em>', () => {
    expect(sanitizeRichText('<p><b>a</b> <i>b</i></p>')).toBe('<p><strong>a</strong> <em>b</em></p>');
  });

  it('is stable: sanitising twice changes nothing', () => {
    const once = sanitizeRichText('<p>Hi <a href="https://a.com" onclick="x()">there</a></p><script>1</script>');
    expect(sanitizeRichText(once)).toBe(once);
  });

  it('escapes stray angle brackets rather than leaving a tag', () => {
    expect(sanitizeRichText('<p>1 < 2 and <b>3</b></p>')).toBe('<p>1 &lt; 2 and <strong>3</strong></p>');
  });
});

describe('sanitizeBlocks', () => {
  it('sanitises the html of rich text blocks only', () => {
    const blocks = [
      { type: 'richText', heading: 'A', html: '<p onclick="x()">Hi</p><script>1</script>' },
      { type: 'hero', headline: '<script>not html, rendered as text</script>' },
    ];
    expect(sanitizeBlocks(blocks)).toEqual([
      { type: 'richText', heading: 'A', html: '<p>Hi</p>' },
      { type: 'hero', headline: '<script>not html, rendered as text</script>' },
    ]);
  });

  it('does not mutate its input', () => {
    const blocks = [{ type: 'richText', html: '<script>1</script><p>a</p>' }];
    sanitizeBlocks(blocks);
    expect(blocks[0].html).toBe('<script>1</script><p>a</p>');
  });

  it('leaves a rich text block with no html alone', () => {
    expect(sanitizeBlocks([{ type: 'richText', heading: 'x' }])).toEqual([{ type: 'richText', heading: 'x' }]);
  });
});
