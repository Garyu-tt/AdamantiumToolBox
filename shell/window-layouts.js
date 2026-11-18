export default {
  "schema": "mas-window-layouts-1",
  "version": 1,
  "gapPx": 6,
  "snapThresholdPx": 26,
  "snapRatio": 0.5,
  "minimumVisiblePx": 46,
  "maxTiled": 8,
  "ratio": {
    "default": 0.62,
    "min": 0.25,
    "max": 0.75,
    "step": 0.05
  },
  "gridColumnsByCount": [
    1,
    2,
    2,
    2,
    3,
    3,
    4,
    4
  ],
  "layouts": [
    {
      "id": "grid",
      "label": "Сетка",
      "mode": "grid"
    },
    {
      "id": "main-left",
      "label": "Главное слева",
      "mode": "main-left"
    },
    {
      "id": "main-right",
      "label": "Главное справа",
      "mode": "main-right"
    },
    {
      "id": "main-top",
      "label": "Главное сверху",
      "mode": "main-top"
    },
    {
      "id": "columns",
      "label": "Колонки",
      "mode": "columns"
    },
    {
      "id": "rows",
      "label": "Ряды",
      "mode": "rows"
    }
  ]
};
