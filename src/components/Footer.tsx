import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';

const links = [
  { label: 'GitHub', href: 'https://github.com/brainbackdoor' },
  { label: 'LinkedIn', href: '#' },
  { label: 'Mail', href: 'mailto:brainbackdoor@gmail.com' },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-background-muted)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 32px' }}>
        <HStack justify="between" vAlign="center">
          <Text type="supporting" color="secondary">© 2016–{year} 이동규 · brainbackdoor</Text>
          <HStack gap={5} vAlign="center">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                <Text type="supporting" as="span">
                  {l.label}
                </Text>
              </Link>
            ))}
            <Link href="/rss.xml">
              <Text type="supporting" as="span" weight="semibold" color="accent">
                RSS
              </Text>
            </Link>
          </HStack>
        </HStack>
      </div>
    </footer>
  );
}
