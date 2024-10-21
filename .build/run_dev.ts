import { setupTweego, Tweenode } from 'tweenode'
import chokidar from 'chokidar'

import { loadConfig } from './handle_config'
import { devEvents, updateState } from './dev_state'
import { moveFiles, runRollup } from './build_commands'

const mode = process.env.NODE_ENV || 'development'
const config = await loadConfig()

await setupTweego()
const tweego = new Tweenode()

const runTweego = async () => {
  const distPath = config.builder!.dist!.output_dir

  const result = await tweego.process({
    input: {
      storyDir: config.builder!.dist!.story.input_dir,
      head: config.builder!.dist!.story.html_head,
      modules: `${distPath}/${config.builder!.dist!.styles.output_dir}`,
      additionalFlags: [
        `${distPath}/${config.builder!.dist!.scripts.output_dir}`,
      ],
    },
    output: {
      mode: 'string',
    },
  })

  return result
}

const build = async (): Promise<string> => {
  const duration = Date.now()
  const rollup = await runRollup()
  await moveFiles()
  const code = await runTweego()

  return new Promise(resolve => {
    console.log(`Rollup finished in ${rollup.duration}ms`)
    console.log('BUILD!')

    console.log(`Build took ${Date.now() - duration}ms`)
    return resolve(code!)
  })
}

build().then(async firstResult => {
  updateState(firstResult)
  await import('./dev_server')

  chokidar
    .watch(config.builder!.prebuilding!.project_root, {
      ignoreInitial: true,
      awaitWriteFinish: {
        pollInterval: 50,
      },
    })
    .on('all', async (event, path) => {
      const result = await build()
      updateState(result)
      devEvents.emit('builded')
    })
})
