import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import clsx from 'clsx';

function NavbarLink({to, label, active}) {
  return (
    <Link
      className={clsx('navbar__item navbar__link', {
        'navbar__link--active': active,
      })}
      to={to}>
      {label}
    </Link>
  );
}

export default function VersionAwareDocsNavbarItem() {
  const {pathname} = useLocation();
  const isV1 = pathname === '/1.0.0' || pathname.startsWith('/1.0.0/');

  if (!isV1) {
    return <NavbarLink to="/" label="Guide" active />;
  }

  return (
    <>
      <NavbarLink
        to="/1.0.0/apps/overview"
        label="Apps"
        active={pathname.startsWith('/1.0.0/apps/')}
      />
      <NavbarLink
        to="/1.0.0/platform/overview"
        label="Platform"
        active={pathname.startsWith('/1.0.0/platform/')}
      />
    </>
  );
}
