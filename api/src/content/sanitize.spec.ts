import { BadRequestException } from '@nestjs/common';
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

  // Regression (BLK-05 verifier): after a refused link, the next closing tag used
  // to be rewritten to </span>, leaving the following link or <strong> unclosed.
  it.each([
    ['<p><a href="javascript:x">bad</a> <a href="https://ok.com">ok</a></p>', '<p>bad <a href="https://ok.com">ok</a></p>'],
    ['<p><a href="javascript:x">bad</a> <strong>b</strong></p>', '<p>bad <strong>b</strong></p>'],
    [
      '<p><a href="javascript:x">bad</a></p><p><a href="https://ok.com">ok</a></p>',
      '<p>bad</p><p><a href="https://ok.com">ok</a></p>',
    ],
    ['<p><a href="javascript:x">a</a> and <a href="data:x">b</a> then <em>c</em></p>', '<p>a and b then <em>c</em></p>'],
    ['<p><a href="javascript:x">a <strong>b</strong></a> <em>c</em></p>', '<p>a <strong>b</strong> <em>c</em></p>'],
  ])('keeps the rest of the document well formed after a refused link: %s', (input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected);
  });

  it('never leaves a stray closing tag, whatever the nesting', () => {
    const out = sanitizeRichText('<p><a href="javascript:x">a<a href="https://ok.com">b</a>c</a><strong>d</strong></p>');
    const opens = (out.match(/<(p|a|strong)[ >]/g) ?? []).length;
    const closes = (out.match(/<\/(p|a|strong)>/g) ?? []).length;
    expect(closes).toBe(opens);
    expect(out).not.toContain('</span>');
  });

  it.each(['//evil.com', '\\\\evil.com', '/\\evil.com'])('drops a link to %s, which would leave the site', (href) => {
    expect(sanitizeRichText(`<p><a href="${href}">x</a></p>`)).toBe('<p>x</p>');
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

  it.each([{ a: 1 }, ['<p>x</p>'], 42, null])('refuses rich text html that is not a string: %j', (html) => {
    expect(() => sanitizeBlocks([{ type: 'richText', html }])).toThrow(BadRequestException);
  });

  it('leaves a rich text block with no html alone', () => {
    expect(sanitizeBlocks([{ type: 'richText', heading: 'x' }])).toEqual([{ type: 'richText', heading: 'x' }]);
  });
});
