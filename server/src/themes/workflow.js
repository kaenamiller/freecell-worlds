// One variation, start to finish, as a Cloudflare Workflow: each model call is a durable
// step with its own retries, so a long run survives restarts and a flaky API call
// doesn't redo the images that already finished.
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { directTheme } from './llm.js';
import { sanitizeSpec } from './spec.js';
import { imageJobs, SERVED, generateImage, generateMusic, deriveImage } from './media.js';
import { setStage, saveSpec, putFile, getFile, finishVariation, failVariation } from './store.js';

const RETRY = { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' }, timeout: '5 minutes' };
const permanent = (e) => (e.permanent ? new NonRetryableError(e.message) : e);

export class ThemeGeneration extends WorkflowEntrypoint {
  async run(event, step) {
    const { themeId, variationId, prompt } = event.payload;
    const env = this.env;
    try {
      const spec = await step.do('art direction', RETRY, async () => {
        await setStage(env, variationId, 'directing');
        const s = sanitizeSpec(await directTheme(env, prompt).catch((e) => { throw permanent(e); }));
        await saveSpec(env, variationId, s);
        return s;
      });

      const [hero, ...rest] = imageJobs(spec);
      let painted = 0;
      const paint = (job, reference) =>
        step.do(`image ${job.id}`, RETRY, async () => {
          const ref = reference ? await getFile(env, themeId, variationId, 'src/hero.png') : null;
          const img = await generateImage(env, job, { reference: ref, spec }).catch((e) => { throw permanent(e); });
          await putFile(env, themeId, variationId, `src/${job.id}.png`, img);
          await setStage(env, variationId, `painting ${++painted}/${rest.length + 1}`);
          return { bytes: img.bytes.byteLength };
        });
      await paint(hero, false);
      // Music runs alongside the images. A failed track isn't fatal: the game falls back
      // to the soundsLike table's music.
      const music = step
        .do('music', RETRY, async () => {
          const track = await generateMusic(env, spec).catch((e) => { throw permanent(e); });
          if (track) await putFile(env, themeId, variationId, 'music.mp3', track);
          return { bytes: track?.bytes.byteLength || 0 };
        })
        .catch((e) => console.warn(`[themes] ${variationId} music skipped: ${e.message}`));
      await Promise.all(rest.map((job) => paint(job, true)));
      await music;

      await step.do('cut served files', RETRY, async () => {
        await setStage(env, variationId, 'finishing');
        for (const served of SERVED) {
          const original = await getFile(env, themeId, variationId, `src/${served.from}.png`);
          await putFile(env, themeId, variationId, served.file, await deriveImage(env, original, served));
        }
        return { files: SERVED.length };
      });

      await step.do('finish', async () => {
        await finishVariation(env, themeId, variationId);
        return true;
      });
    } catch (e) {
      console.error(`[themes] ${variationId} failed: ${e.message}`);
      await step.do('record failure', async () => {
        await failVariation(env, themeId, variationId, e.message);
        return true;
      });
    }
  }
}
