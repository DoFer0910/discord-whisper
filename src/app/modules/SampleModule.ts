import { BaseModule } from 'mopo-discordjs'
export default class SampleModule extends BaseModule {
  public async init(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
    console.log('SampleModule initialized')
  }
}
