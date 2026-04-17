use clap::{Parser, Subcommand};
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    execute,
    terminal::{Clear, ClearType},
};
use serde::{Deserialize, Serialize};
use std::io::{stdout, Write};
use std::path::PathBuf;
use std::{fs, thread, time::Duration};

/// ASCII Anim CLI — validate, inspect, and play .aanim scene files.
#[derive(Parser)]
#[command(name = "ascii-anim", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate a scene file against the schema
    Validate {
        /// Scene files to validate
        scenes: Vec<PathBuf>,
        /// Strict mode: fail on warnings
        #[arg(long)]
        strict: bool,
    },
    /// Show scene metadata and statistics
    Info {
        /// Scene file
        scene: PathBuf,
    },
    /// Play a scene in the terminal via ANSI
    Play {
        /// Scene file
        scene: PathBuf,
        /// Loop playback
        #[arg(long)]
        r#loop: bool,
    },
    /// Export a scene to a format (json output of scene data)
    Render {
        /// Scene file
        scene: PathBuf,
        /// Output format: json
        #[arg(short, long, default_value = "json")]
        format: String,
        /// Output file
        #[arg(short, long)]
        out: Option<PathBuf>,
    },
}

// ── Scene types (mirrors @ascii-anim/core) ────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct Scene {
    version: u32,
    duration: u32,
    fps: Option<u32>,
    grid: Option<Grid>,
    sprites: Vec<Sprite>,
    #[serde(skip_serializing_if = "Option::is_none")]
    meta: Option<SceneMeta>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Grid {
    cols: u32,
    rows: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct SceneMeta {
    title: Option<String>,
    author: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Sprite {
    id: String,
    text: String,
    keyframes: Vec<Keyframe>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hidden: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Keyframe {
    t: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    opacity: Option<f64>,
    #[serde(rename = "fontSize", skip_serializing_if = "Option::is_none")]
    font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rotation: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    easing: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
}

// ── Defaults ──────────────────────────────────────────────────────

const DEF_X: f64 = 5.0;
const DEF_Y: f64 = 5.0;
const DEF_OPACITY: f64 = 1.0;

// ── Sampling ──────────────────────────────────────────────────────

fn ease(t: f64, easing: &Option<serde_json::Value>) -> f64 {
    match easing {
        Some(serde_json::Value::String(s)) => match s.as_str() {
            "in" => t * t,
            "out" => 1.0 - (1.0 - t).powi(2),
            "inout" => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    1.0 - 2.0 * (1.0 - t).powi(2)
                }
            }
            _ => t,
        },
        _ => t,
    }
}

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

struct Sampled {
    x: f64,
    y: f64,
    opacity: f64,
    text: String,
}

fn sample_sprite(sprite: &Sprite, t: u32) -> Sampled {
    let kfs = &sprite.keyframes;
    let text = text_at(sprite, t);

    if kfs.is_empty() {
        return Sampled {
            x: DEF_X,
            y: DEF_Y,
            opacity: DEF_OPACITY,
            text,
        };
    }

    let tf = t as f64;
    let first = &kfs[0];
    if tf <= first.t as f64 {
        return Sampled {
            x: first.x.unwrap_or(DEF_X),
            y: first.y.unwrap_or(DEF_Y),
            opacity: first.opacity.unwrap_or(DEF_OPACITY),
            text,
        };
    }

    let last = &kfs[kfs.len() - 1];
    if tf >= last.t as f64 {
        return Sampled {
            x: last.x.unwrap_or(DEF_X),
            y: last.y.unwrap_or(DEF_Y),
            opacity: last.opacity.unwrap_or(DEF_OPACITY),
            text,
        };
    }

    // Binary search
    let mut lo = 0;
    let mut hi = kfs.len() - 2;
    while lo < hi {
        let mid = (lo + hi).div_ceil(2);
        if (kfs[mid].t as f64) <= tf {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }

    let a = &kfs[lo];
    let b = &kfs[lo + 1];
    let p = (tf - a.t as f64) / (b.t as f64 - a.t as f64);
    let eased = ease(p, &b.easing);

    Sampled {
        x: lerp(a.x.unwrap_or(DEF_X), b.x.unwrap_or(DEF_X), eased),
        y: lerp(a.y.unwrap_or(DEF_Y), b.y.unwrap_or(DEF_Y), eased),
        opacity: lerp(
            a.opacity.unwrap_or(DEF_OPACITY),
            b.opacity.unwrap_or(DEF_OPACITY),
            eased,
        ),
        text,
    }
}

fn text_at(sprite: &Sprite, t: u32) -> String {
    let mut result = sprite.text.clone();
    for kf in &sprite.keyframes {
        if kf.t > t {
            break;
        }
        if let Some(ref txt) = kf.text {
            result = txt.clone();
        }
    }
    result
}

// ── Commands ──────────────────────────────────────────────────────

fn load_scene(path: &PathBuf) -> Result<Scene, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    let scene: Scene =
        serde_json::from_str(&content).map_err(|e| format!("parse {}: {e}", path.display()))?;
    Ok(scene)
}

fn cmd_validate(scenes: &[PathBuf], strict: bool) -> i32 {
    let mut errors = 0;
    for path in scenes {
        match load_scene(path) {
            Ok(scene) => {
                let mut issues = Vec::new();
                if scene.version != 1 {
                    issues.push(format!("unsupported version {}", scene.version));
                }
                if scene.duration == 0 {
                    issues.push("duration must be positive".into());
                }
                let mut ids = std::collections::HashSet::new();
                for (si, sprite) in scene.sprites.iter().enumerate() {
                    if !ids.insert(&sprite.id) {
                        issues.push(format!("sprites/{si}: duplicate id \"{}\"", sprite.id));
                    }
                    for (ki, kf) in sprite.keyframes.iter().enumerate() {
                        if kf.t > scene.duration {
                            issues.push(format!(
                                "sprites/{si}/keyframes/{ki}: t={} exceeds duration={}",
                                kf.t, scene.duration
                            ));
                        }
                    }
                }
                if issues.is_empty() {
                    println!("  ✓ {}", path.display());
                } else if strict {
                    println!("  ✗ {}: {} issue(s)", path.display(), issues.len());
                    for issue in &issues {
                        println!("    - {issue}");
                    }
                    errors += 1;
                } else {
                    println!(
                        "  ⚠ {}: {} warning(s)",
                        path.display(),
                        issues.len()
                    );
                    for issue in &issues {
                        println!("    - {issue}");
                    }
                }
            }
            Err(e) => {
                println!("  ✗ {e}");
                errors += 1;
            }
        }
    }
    if errors > 0 {
        1
    } else {
        0
    }
}

fn cmd_info(path: &PathBuf) -> i32 {
    match load_scene(path) {
        Ok(scene) => {
            println!("File:     {}", path.display());
            println!("Version:  {}", scene.version);
            println!(
                "Duration: {}ms ({:.1}s)",
                scene.duration,
                scene.duration as f64 / 1000.0
            );
            println!("FPS:      {}", scene.fps.unwrap_or(60));
            if let Some(ref grid) = scene.grid {
                println!("Grid:     {}×{}", grid.cols, grid.rows);
            }
            println!("Sprites:  {}", scene.sprites.len());
            let total_kf: usize = scene.sprites.iter().map(|s| s.keyframes.len()).sum();
            println!("Keyframes: {total_kf} total");
            if let Some(ref meta) = scene.meta {
                if let Some(ref title) = meta.title {
                    println!("Title:    {title}");
                }
                if let Some(ref author) = meta.author {
                    println!("Author:   {author}");
                }
            }
            0
        }
        Err(e) => {
            eprintln!("Error: {e}");
            1
        }
    }
}

fn cmd_play(path: &PathBuf, looping: bool) -> i32 {
    let scene = match load_scene(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: {e}");
            return 1;
        }
    };

    let cols = scene.grid.as_ref().map_or(60, |g| g.cols) as usize;
    let rows = scene.grid.as_ref().map_or(13, |g| g.rows) as usize;
    let fps = scene.fps.unwrap_or(30);
    let frame_ms = 1000 / fps;

    let mut stdout = stdout();
    execute!(stdout, Hide, Clear(ClearType::All)).ok();

    // Set up ctrl-c handler
    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let r = running.clone();
    ctrlc_setup(r);

    let mut t: u32 = 0;
    while running.load(std::sync::atomic::Ordering::Relaxed) {
        // Build text grid
        let mut grid = vec![vec![' '; cols]; rows];

        for sprite in &scene.sprites {
            if sprite.hidden == Some(true) {
                continue;
            }
            let sampled = sample_sprite(sprite, t);
            if sampled.opacity < 0.1 {
                continue;
            }
            let col = sampled.x.round() as i32;
            let row = sampled.y.round() as i32;
            for (i, ch) in sampled.text.chars().enumerate() {
                let c = col + i as i32;
                if row >= 0 && (row as usize) < rows && c >= 0 && (c as usize) < cols {
                    grid[row as usize][c as usize] = ch;
                }
            }
        }

        // Render
        execute!(stdout, MoveTo(0, 0)).ok();
        for row in &grid {
            let line: String = row.iter().collect();
            write!(stdout, "{line}\r\n").ok();
        }
        stdout.flush().ok();

        thread::sleep(Duration::from_millis(frame_ms as u64));
        t += frame_ms;
        if t >= scene.duration {
            if looping {
                t = 0;
            } else {
                break;
            }
        }
    }

    execute!(stdout, Show).ok();
    0
}

fn ctrlc_setup(_running: std::sync::Arc<std::sync::atomic::AtomicBool>) {
    #[cfg(unix)]
    unsafe {
        libc::signal(libc::SIGINT, {
            extern "C" fn handler(_: libc::c_int) {
                let mut stdout = stdout();
                execute!(stdout, Show).ok();
                std::process::exit(0);
            }
            handler as *const () as libc::sighandler_t
        });
    }
}

fn cmd_render(path: &PathBuf, format: &str, out: &Option<PathBuf>) -> i32 {
    let scene = match load_scene(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: {e}");
            return 1;
        }
    };

    let content = match format {
        "json" => match serde_json::to_string_pretty(&scene) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Serialize error: {e}");
                return 1;
            }
        },
        _ => {
            eprintln!("Unsupported format: {format}. Available: json");
            return 1;
        }
    };

    match out {
        Some(p) => {
            if let Err(e) = fs::write(p, &content) {
                eprintln!("Write error: {e}");
                return 1;
            }
            println!("Wrote {}", p.display());
        }
        None => print!("{content}"),
    }
    0
}

fn main() {
    let cli = Cli::parse();
    let code = match &cli.command {
        Commands::Validate { scenes, strict } => cmd_validate(scenes, *strict),
        Commands::Info { scene } => cmd_info(scene),
        Commands::Play { scene, r#loop } => cmd_play(scene, *r#loop),
        Commands::Render {
            scene,
            format,
            out,
        } => cmd_render(scene, format, out),
    };
    std::process::exit(code);
}
