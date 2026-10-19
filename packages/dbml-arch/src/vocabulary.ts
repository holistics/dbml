// The built-in roles and the words that cannot name one live in @dbml/parse, which reads architecture files too.
export {
  BUILTIN_KINDS, RESERVED, isReserved, suggestKind, suggestIcon,
  ICON_ALIAS, ICON_NAMES, isIconName, resolveIcon,
} from '@dbml/parse';
export type { KindSpec } from '@dbml/parse';
