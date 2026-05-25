# Sample Annotated Dataset

This folder contains sample biomedical annotation data for demonstrating the BioAnnot platform.

## Files

| File | Description |
|------|-------------|
| `ecg_sample.csv` | Synthetic ECG signal — 500 samples at 100 Hz over 5 seconds |
| `ecg_sample.json` | Same ECG in JSON format `{times:[], values:[]}` |
| `ecg_annotations.json` | 8 pre-made annotations (5 R-peaks + 3 QRS intervals) |
| `xray_annotations.json` | 3 image annotations (2 bboxes + 1 polygon) for a 512×512 chest X-ray |

## Loading in BioAnnot

1. **Signal:** Click "Load signal (CSV / JSON)" and select `ecg_sample.csv`
2. **Import annotations:** Use the "↓ JSON" export flow to see the format; manually load via browser console:
   ```js
   localStorage.setItem('bioannot_annotations', JSON.stringify( /* paste JSON */ ))
   ```
3. **Image:** Load any PNG/JPEG and draw annotations; export as JSON

## Annotation Schema

```json
{
  "id": "uuid",
  "type": "peak | interval | bbox | polygon",
  "label": "optional string",
  "color": "#hex",
  "status": "approved | rejected | undefined (pending)",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000
}
```

## Statistics
- Total annotations: 11
- Approved: 8
- Pending review: 3
- Modalities: ECG (signal), Chest X-ray (image)
