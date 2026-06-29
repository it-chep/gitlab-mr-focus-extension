# GitLab MR Focus

Chrome extension for simplifying GitLab Merge Request review.

## Available filters

- `Скрыть e2e`: hides all files inside the `e2e` directory.
- `internal/pb/*`: hides generated files under `internal/pb/*`.
- `*_test.go`: hides Go test files matching `*_test.go`.
- `mocks`: hides files in `mocks` directories and files matching `*_mock.go` or `*_mocks.go`.

Filters can be combined in any set.
The popup also has a `Выбрать все` checkbox to turn on every filter and then disable individual ones.

## How to launch

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder with this extension.

## Notes

- The extension uses `Manifest V3`.
- It works by finding GitLab diff file containers and applying `display: none`.
- Different GitLab versions can use slightly different DOM markup, so selectors in `content.js` may need minor tuning for your instance.
