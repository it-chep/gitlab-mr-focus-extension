# GitLab MR Focus

Chrome extension for simplifying GitLab Merge Request review.

## Current modes

- `Выключено`: does not hide anything.
- `Фокус`: hides files under `internal/pb/*` and files matching `*_test.go`.
- `Только e2e`: hides everything except files from the `e2e` directory.

## How to launch

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder with this extension.

## Notes

- The extension uses `Manifest V3`.
- It works by finding GitLab diff file containers and applying `display: none`.
- Different GitLab versions can use slightly different DOM markup, so selectors in `content.js` may need minor tuning for your instance.
