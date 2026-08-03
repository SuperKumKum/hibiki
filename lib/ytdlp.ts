import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

/**
 * yt-dlp integration
 *
 * @description Wraps every yt-dlp invocation behind a bounded concurrency gate and
 * resolves which copy of yt-dlp to run. Updates install into a directory on the data
 * volume, so a new version survives container restarts without rebuilding the image
 * (`yt-dlp -U` cannot work here: the image installs yt-dlp with pip, and yt-dlp refuses
 * to self-update a package-manager install).
 */

/** Maximum yt-dlp processes running at once. Each one is a network-bound child process. */
const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.YTDLP_MAX_CONCURRENCY || "2", 10));

/** Directory on the data volume where updates are installed. */
const UPDATE_TARGET_DIR = join(process.cwd(), "data", "ytdlp");

/**
 * Bounds how many operations run at the same time
 *
 * @description Without this, a playlist download or a burst of searches spawns one
 * process per item with no ceiling, which starves the host and gets the instance
 * rate-limited by YouTube.
 *
 * @example
 * await semaphore.run(() => doWork())
 */
class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await operation();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  getStats(): { active: number; queued: number; limit: number } {
    return { active: this.active, queued: this.waiting.length, limit: this.limit };
  }
}

const ytDlpSemaphore = new Semaphore(MAX_CONCURRENCY);

/** How yt-dlp should be launched. */
interface YtDlpInvocation {
  command: string;
  prefixArgs: string[];
  env?: NodeJS.ProcessEnv;
  source: "volume" | "system";
}

let cachedInvocation: YtDlpInvocation | null = null;

/**
 * Decides which yt-dlp to run
 *
 * @description Prefers a copy installed on the data volume by updateYtDlp(), falling back
 * to the one baked into the image. Resolution is cached and cleared after an update.
 *
 * @returns Command, leading arguments and environment to spawn with
 */
function resolveYtDlp(): YtDlpInvocation {
  if (cachedInvocation) return cachedInvocation;

  // A pip --target install exposes the package directory directly
  if (existsSync(join(UPDATE_TARGET_DIR, "yt_dlp", "__main__.py"))) {
    cachedInvocation = {
      command: "python3",
      prefixArgs: ["-m", "yt_dlp"],
      env: { ...process.env, PYTHONPATH: UPDATE_TARGET_DIR },
      source: "volume",
    };
    console.log("[yt-dlp] Using updated copy from", UPDATE_TARGET_DIR);
    return cachedInvocation;
  }

  // Development on Windows with a local venv
  if (process.platform === "win32" && process.env.NODE_ENV !== "production") {
    cachedInvocation = {
      command: join(process.cwd(), ".venv", "Scripts", "yt-dlp.exe"),
      prefixArgs: [],
      source: "system",
    };
    return cachedInvocation;
  }

  cachedInvocation = { command: "yt-dlp", prefixArgs: [], source: "system" };
  return cachedInvocation;
}

let cachedCookiesPath: string | null | undefined;

/**
 * Locates a cookies file once per process
 *
 * @description Resolution used to run on every invocation and logged five lines each
 * time, which buried real errors in the container logs.
 *
 * @returns Path to the cookies file, or null when none is present
 */
function getCookiesPath(): string | null {
  if (cachedCookiesPath !== undefined) return cachedCookiesPath;

  const candidates = [
    join(process.cwd(), "data", "cookies.txt"),
    join(process.cwd(), "cookies.txt"),
    "/data/cookies.txt", // Docker volume mount
  ];

  cachedCookiesPath = candidates.find((path) => existsSync(path)) ?? null;
  console.log(
    cachedCookiesPath
      ? `[yt-dlp] Using cookies file: ${cachedCookiesPath}`
      : "[yt-dlp] No cookies file found, some videos may not work",
  );

  return cachedCookiesPath;
}

/** Arguments shared by every yt-dlp call. */
function getCommonArgs(): string[] {
  const args: string[] = [];

  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }

  // Remote challenge solver script for YouTube signature decryption
  args.push("--remote-components", "ejs:github");
  args.push("--js-runtimes", "node");

  return args;
}

/**
 * Spawns a child process and collects its output
 *
 * @param command Executable to run
 * @param args Arguments to pass
 * @param options.timeout Milliseconds before the process is killed
 * @param options.env Environment for the child process
 * @returns Captured stdout on success
 */
function executeCommand(
  command: string,
  args: string[],
  options: { timeout: number; env?: NodeJS.ProcessEnv } = { timeout: 30000 },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { env: options.env });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(`[${command}] Timeout after ${options.timeout}ms, killing process`);
      childProcess.kill("SIGKILL");
      reject(new Error(`Process timeout after ${options.timeout}ms`));
    }, options.timeout);

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (code === 0) {
        resolve(stdout);
      } else {
        console.error(`[${command}] Exit ${code}:`, stderr.trim());
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
    });

    childProcess.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Runs yt-dlp, waiting for a free concurrency slot first
 *
 * @param args Arguments for yt-dlp
 * @param timeout Milliseconds before the process is killed
 * @returns Captured stdout
 */
async function executeYtDlp(args: string[], timeout: number = 30000): Promise<string> {
  const { command, prefixArgs, env } = resolveYtDlp();

  return ytDlpSemaphore.run(() =>
    executeCommand(command, [...prefixArgs, ...args], { timeout, env }),
  );
}

/** Current concurrency gate state, for diagnostics. */
export function getYtDlpQueueStats(): { active: number; queued: number; limit: number } {
  return ytDlpSemaphore.getStats();
}

/**
 * Picks the highest resolution thumbnail available
 *
 * @param data Raw yt-dlp JSON for one video
 * @returns Thumbnail URL, falling back to the standard YouTube URL
 */
function pickThumbnail(data: {
  id?: string;
  thumbnails?: { url?: string; width?: number }[];
}): string {
  const best = (data.thumbnails ?? [])
    .filter((t) => t.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0];

  const thumbnail = best?.url || data.thumbnails?.[0]?.url || "";
  if (thumbnail) return thumbnail;

  return data.id ? `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg` : "";
}

export interface YtDlpMetadata {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
}

export async function getYoutubeMetadata(url: string): Promise<YtDlpMetadata> {
  try {
    const stdout = await executeYtDlp(
      [
        ...getCommonArgs(),
        "--dump-json",
        "--no-warnings",
        "--no-playlist", // Only extract the video, not the playlist
        "--flat-playlist",
        url,
      ],
      60000,
    );

    const data = JSON.parse(stdout);

    return {
      id: data.id,
      title: data.title,
      channel: data.channel || data.uploader || "Unknown",
      thumbnail: pickThumbnail(data),
      duration: data.duration || 0,
    };
  } catch (error) {
    console.error("[getYoutubeMetadata] Error:", error);
    throw new Error(`Failed to get metadata: ${error}`);
  }
}

export async function getStreamUrl(youtubeId: string): Promise<string> {
  try {
    const stdout = await executeYtDlp([
      ...getCommonArgs(),
      "-g",
      "-f",
      "bestaudio",
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get stream URL: ${error}`);
  }
}

/** Reported yt-dlp state. */
export interface YtDlpStatus {
  version: string | null;
  source: "volume" | "system";
  updateTargetDir: string;
  concurrencyLimit: number;
}

/**
 * Reports the running yt-dlp version and where it comes from
 *
 * @returns Version string (null when it could not be read) and install source
 */
export async function getYtDlpStatus(): Promise<YtDlpStatus> {
  const { command, prefixArgs, env, source } = resolveYtDlp();
  let version: string | null = null;

  try {
    // Deliberately bypasses the concurrency gate: reading the version is instant and
    // diagnostic, and queueing it behind downloads would hang the admin status view
    // exactly when someone is looking at it.
    version = (
      await executeCommand(command, [...prefixArgs, "--version"], { timeout: 20000, env })
    ).trim();
  } catch (error) {
    console.error("[getYtDlpStatus] Could not read version:", error);
  }

  return {
    version,
    source,
    updateTargetDir: UPDATE_TARGET_DIR,
    concurrencyLimit: MAX_CONCURRENCY,
  };
}

/**
 * Installs the latest yt-dlp onto the data volume
 *
 * @description `yt-dlp -U` refuses to update a pip install, so this installs into a
 * directory on the persistent volume with pip and repoints resolution at it. The image's
 * own copy stays as a fallback.
 *
 * @returns Version before and after the update
 */
export async function updateYtDlp(): Promise<{ previousVersion: string | null; version: string | null }> {
  const before = await getYtDlpStatus();

  try {
    await executeCommand(
      "pip3",
      [
        "install",
        "--upgrade",
        "--no-cache-dir",
        "--break-system-packages",
        "--target",
        UPDATE_TARGET_DIR,
        "yt-dlp",
      ],
      { timeout: 300000 },
    );
  } catch (error) {
    throw new Error(`Failed to update yt-dlp: ${error}`);
  }

  // Force re-resolution so the freshly installed copy is picked up
  cachedInvocation = null;

  const after = await getYtDlpStatus();
  console.log(`[yt-dlp] Updated from ${before.version ?? "unknown"} to ${after.version ?? "unknown"}`);

  return { previousVersion: before.version, version: after.version };
}

export interface SearchResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
}

export async function searchYoutube(query: string, limit: number = 10): Promise<SearchResult[]> {
  try {
    const stdout = await executeYtDlp(
      [
        ...getCommonArgs(),
        "--dump-json",
        "--no-warnings",
        "--flat-playlist",
        `ytsearch${limit}:${query}`,
      ],
      60000,
    );

    return parseJsonLines(stdout).map((data) => ({
      id: data.id,
      title: data.title || "Unknown",
      channel: data.channel || data.uploader || "Unknown",
      thumbnail: pickThumbnail(data),
      duration: data.duration || 0,
    }));
  } catch (error) {
    console.error("[searchYoutube] Error:", error);
    throw new Error(`Failed to search YouTube: ${error}`);
  }
}

/**
 * Parses yt-dlp's newline-delimited JSON output
 *
 * @param stdout Raw output, one JSON object per line
 * @returns Parsed entries that carry an id, skipping malformed lines
 */
function parseJsonLines(stdout: string): any[] {
  return stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((data: any) => data && data.id);
}

export async function getYoutubePlaylistMetadata(url: string): Promise<
  Array<{
    id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration: number;
  }>
> {
  try {
    const stdout = await executeYtDlp(
      [...getCommonArgs(), "--dump-json", "--no-warnings", "--flat-playlist", url],
      120000,
    );

    const videos = parseJsonLines(stdout);
    console.log("[getYoutubePlaylistMetadata] Found", videos.length, "videos in playlist");

    return videos.map((data) => ({
      id: data.id,
      title: data.title,
      channel: data.channel || data.uploader || "Unknown",
      thumbnail: pickThumbnail(data),
      duration: data.duration || 0,
    }));
  } catch (error) {
    console.error("[getYoutubePlaylistMetadata] Error:", error);
    throw new Error(`Failed to get playlist metadata: ${error}`);
  }
}

export async function downloadAudio(youtubeId: string, outputPath: string): Promise<void> {
  try {
    await executeYtDlp(
      [
        ...getCommonArgs(),
        "-f",
        "bestaudio",
        "-x", // Extract audio
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0", // Best quality
        "-o",
        outputPath,
        "--no-playlist",
        `https://www.youtube.com/watch?v=${youtubeId}`,
      ],
      300000, // 5 minute timeout for download
    );
  } catch (error) {
    console.error("[downloadAudio] Error:", error);
    throw new Error(`Failed to download audio: ${error}`);
  }
}
