import run_test from '@hydre/integration-tests'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
run_test({
  compose_file: dirname(fileURLToPath(import.meta.url)),
  endpoint: 'http://localhost:3615'
})