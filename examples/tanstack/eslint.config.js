//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import query from '@tanstack/eslint-plugin-query'
import router from '@tanstack/eslint-plugin-router'

export default [
  ...tanstackConfig,
  ...query.configs['flat/recommended'],
  ...router.configs['flat/recommended'],
]
