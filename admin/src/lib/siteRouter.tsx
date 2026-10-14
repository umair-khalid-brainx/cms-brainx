import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  Navigate as RouterNavigate,
  useNavigate as useRouterNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
  type NavigateProps,
  type To,
} from 'react-router'
import { siteBase } from './activeSite'
import { scoped } from './sitePath'

const scope = (to: To) => scoped(to, siteBase())

export function Link(props: LinkProps) {
  return <RouterLink {...props} to={scope(props.to)} />
}

export function NavLink(props: NavLinkProps) {
  return <RouterNavLink {...props} to={scope(props.to)} />
}

export function Navigate(props: NavigateProps) {
  return <RouterNavigate {...props} to={scope(props.to)} />
}

export function useNavigate() {
  const navigate = useRouterNavigate()
  return (to: To | number, options?: NavigateOptions) => (typeof to === 'number' ? navigate(to) : navigate(scope(to), options))
}
