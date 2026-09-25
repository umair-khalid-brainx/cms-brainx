import { Link } from 'react-router';
import { listPages } from '../lib/pagesStore';
import { siteUrl } from '../data/site';
import './PagesListPage.css';

function PagesListPage() {
  const pages = listPages();

  return (
    <>
      <div className="pages-header">
        <h1 className="pages-title">Pages</h1>
        <span className="pages-count">{pages.length} pages</span>
      </div>

      <table className="pages-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Path</th>
            <th>Status</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.slug}>
              <td>
                <Link to={`/editor/${page.slug}`} className="pages-row-title">
                  {page.title}
                </Link>
              </td>
              <td className="pages-row-path">{page.path}</td>
              <td>
                <span className={`pages-status pages-status-${page.status}`}>{page.status}</span>
              </td>
              <td className="pages-row-actions">
                <Link to={`/editor/${page.slug}`}>Edit</Link>
                <a href={siteUrl(page.path)} target="_blank" rel="noreferrer">
                  View
                  <span aria-hidden="true">&#8599;</span>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default PagesListPage;
