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

  return (
    <>
      <NavbarLink
        to="/beta/getting-started"
        label="Beta 가이드"
        active={pathname.startsWith('/beta/')}
      />
      <NavbarLink
        to="/apps/overview"
        label="Apps"
        active={pathname.startsWith('/apps/')}
      />
      <NavbarLink
        to="/platform/overview"
        label="Platform"
        active={pathname.startsWith('/platform/')}
      />
    </>
  );
}
