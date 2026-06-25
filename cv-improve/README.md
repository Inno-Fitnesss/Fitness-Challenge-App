# WowFit CV Improve

`cv-improve` — новая версия браузерного CV-прототипа для подсчёта упражнений.

Папка специально сделана плоской:

```text
cv-improve/
  app.js
  index.html
  styles.css
  README.md
```

Старый контрольный образец оставлен отдельно в `cv-test`.

## Что улучшено для отжиманий

Параметры классических отжиманий подобраны по данным:

```text
data/pushup/labels/correct.npy
data/pushup/labels/incorrect.npy
```

Формат данных:

```text
(количество видео, 150 кадров, 66 координат)
```

Каждый кадр преобразуется в `(33, 2)`, где 33 точки — это MediaPipe landmarks, а координаты — `x, y`.

Главная цель настройки — максимальный recall: все correct-видео должны получить ровно `1` повтор.

## Итоговые параметры pushup

```json
{
  "bottom": 90,
  "top": 125,
  "bodyLine": 160,
  "classicMaxTilt": 25,
  "pushupMinStableFrames": 1,
  "pushupSmoothAlpha": 0.45
}
```

Эти значения перенесены в `app.js` только для pushup-логики. Для squat/plank общий `MIN_STABLE_FRAMES = 3` сохранён.

## Результат на полном наборе

| Version | Accuracy | Precision | Recall | F1 | TP | TN | FP | FN |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `cv-test` baseline | 0.670 | 0.613 | 0.920 | 0.736 | 46 | 21 | 29 | 4 |
| `cv-improve` | 0.850 | 0.769 | 1.000 | 0.870 | 50 | 35 | 15 | 0 |

Интерпретация:

- TP: `correct.npy`, модель насчитала ровно `1`;
- FN: `correct.npy`, модель насчитала не `1`;
- TN: `incorrect.npy`, модель насчитала ровно `0`;
- FP: `incorrect.npy`, модель насчитала не `0`.

## Как проверялось

Скрипт подбора:

```bash
python tune_cv_improve_pushup.py
```

Он делает repeated stratified train/test split, подбирает параметры с приоритетом recall, а затем сохраняет:

- `cv_improve_tuning_results.csv`
- `cv_improve_tuning_summary.json`
- `cv_improve_tuning_report.md`
- `cv_improve_predictions.csv`

## Запуск прототипа

Из папки `cv-improve`:

```bash
python -m http.server 8765
```

Открыть:

```text
http://localhost:8765
```

MediaPipe и модель загружаются через интернет, само видео обрабатывается локально в браузере.
