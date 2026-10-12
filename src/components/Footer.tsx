import { contact, sns } from '../data/about';

const links = sns.filter(link => ['GitHub', 'LinkedIn'].includes(link.label));

export default function Footer() {
  return (
    <footer className="site-footer" data-pagefind-ignore>
      <p>© 2016–{new Date().getFullYear()} 이동규</p>
      <nav aria-label="외부 링크">
        {links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>)}
        <a href={`mailto:${contact}`}>이메일</a>
        <a href="/rss.xml">RSS</a>
      </nav>
    </footer>
  );
}
