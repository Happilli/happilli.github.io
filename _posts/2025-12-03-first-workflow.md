---
title: First Workflow
date: 2025-12-03 14:00:00 +0000
categories: [git, devops]
tags: [workflow]
description: A workflow that generates optimized thumbnails for fast wallpaper previews
---

Most wallpaper websites feel heavy because they serve full-resolution images as thumbnails or generate previews through backend processing. I wanted a lightweight, frontend-only solution, so I created a GitHub workflow that automatically generates optimized thumbnails and maps them to their actual source.

[HERE](https://github.com/RyuZinOh/.dotfiles/blob/main/.github/workflows/wallpaperv-helper.yml) is the piece of code which was implemented:

```yml
name: Generate & Upload Thumbnails
on:
  push:
    paths:
      - "Pictures/**.jpg"
      - "Pictures/**.jpeg"
  schedule:
    - cron: "*/5 * * * *" # every 5 minutes
  workflow_dispatch: # manual trigger
```

- The workflow triggers automatically whenever `.jpg` or `.jpeg` images in the `Pictures/` directory are added or modified. Other formats like `.png` are excluded for efficiency.
- It also runs automatically every five minutes via a scheduled cron job, regardless of changes.
- Manual execution is supported through the `workflow_dispatch` trigger.

```yml
jobs:
  generate-thumbs:
    runs-on: ubuntu-latest
    permissions:
      contents: write
```

- It has the single job to generate-thumbs and runs on ubuntu environment
- Needs `contents: write` so that we can push updates

```yml
steps:
  - name: Checkout repository [main branch for source ]
    uses: actions/checkout@v3
    with:
      fetch-depth: 0
      ref: main
```

- Clones the main branch
- Fetch-depth ensures full git history so that we can access existing thumbnails
- ref ensures we working on main branch at first

```yml
- name: Install ImageMagick
    run:sudo apt-get update && sudo apt-get install -y imagemagick
    - name:Check for images
    id:check
    run:|
    if ls Pictures/*.jpg Pictures/*.jpeg 1> /dev/null 2>&1; then
    echo "has_images=true" >> $GITHUB_OUTPUT
    else
    echo "has_images=false" >> $GITHUB_OUTPUT
    echo "No images found to process"
    fi
```

- Installing imagemagick package for image manipulation
- Lists everything jpeg/jpg files images inside Pictures directory and return the has_image accordingly, further we can reference later from that check name

```yml
- name: Generate thumbnails in main branch
  if: steps.check.outputs.has_images == 'true'
  run: |
    mkdir -p /tmp/new_thumbs
    git fetch origin thumbs:thumbs 2>/dev/null || echo "thumbs branch doesn't exist."
    shopt -s nullglob
    echo "=== Processing thumbnails ==="
    for img in Pictures/*.jpg Pictures/*.jpeg; do
      [ -f "$img" ] || continue
      base=$(basename "$img")
      
      if git show thumbs:thumbnails/"$base" > /dev/null 2>&1; then
        echo "Skip: $base (thumbnail already exists)"
      else
        echo "Generate: $base"
        convert "$img" -resize 320x200^ -gravity center -extent 320x200 "/tmp/new_thumbs/$base"
      fi
    done
    echo ""
    echo "=== New thumbnails generated ==="
    ls -lh /tmp/new_thumbs/ 2>/dev/null || echo "No new thumbs"
```

- Generates thumbnails only if `has_images` is `true` from the previous check
- Creates a temporary folder to store newly generated thumbnails
- Fetchs the `thumbs` branch to check for existing thumbnails
- Loops through all images in the `Pictures/` folder and extract the basename (filename with extension)
- Skips images that already have corresponding thumbnails in the branch
- Uses ImageMagick `convert` to create 320X200 thumbnails, preserving the same filename and extension in the temporary folder so that mapping would be easier later in sites

```yml
- name: Switch to thumbs branch and sync
  if: steps.check.outputs.has_images == 'true'
  run: |
    git config --local user.email "github-actions[bot]@users.noreply.github.com"
    git config --local user.name "github-actions[bot]"
    shopt -s nullglob
    mkdir -p /tmp/source_list
    for img in Pictures/*.jpg Pictures/*.jpeg; do
      [ -f "$img" ] && touch "/tmp/source_list/$(basename "$img")"
    done
```

- Configures Git with a local username and email for commits
- Enables nullglob to safely handle empty file patterns in loops
- Creates a temporary folder to track source images
- Loops through all JPG and JPEG files in the Pictures folder and record their basenames in the temporary folder

```yml
if git show-ref --verify --quiet refs/remotes/origin/thumbs; then
git checkout thumbs
else
git checkout --orphan thumbs
git rm -rf . 2>/dev/null || true
mkdir -p thumbnails
git commit --allow-empty -m "Initialize thumbs branch"
fi
mkdir -p thumbnails
if [ -d "/tmp/new_thumbs" ] && [ "$(ls -A /tmp/new_thumbs)" ]; then
cp /tmp/new_thumbs/* thumbnails/
fi
```

- Checks if the `thumbs` branch exists on the remote
  - If it exists, switches to the `thumbs` branch
  - If it does not exist, creates a new orphan `thumbs` branch, remove all files, creates the `thumbnails` folder, and make an initial empty commit

```yml

    echo ""
    echo "=== Cleaning orphaned thumbnails ==="
    for thumb in thumbnails/*.jpg thumbnails/*.jpeg; do
      [ -f "$thumb" ] || continue
      base=$(basename "$thumb")

      # Check if source image exists in main branch
      if [ ! -f "/tmp/source_list/$base" ]; then
        echo "Delete:$base (source image missing)"
        rm "$thumb"
      fi
    done
    echo ""
    echo "=== Current thumbnails ==="
    ls -lh thumbnails/ || echo "No thumbnails"
    git add thumbnails/
    if git diff --staged --quiet; then
      echo "No changes to commit"
    else
      git commit -m "Auto-sync thumbnails [skip ci]"
      git push origin thumbs
      echo "Thumbnails synced to thumbs branch"
    fi
```

- Loops through all JPEG and JPG files in the `thumbnails` folder
  - For each file, gets it basename
  - If the corresponding source image does not exist in `/tmp/source_list`, deletes the thumbnail

> The creating of branch might work or not...
> Well fuck around' n find out !!
> {: .prompt-warning }
