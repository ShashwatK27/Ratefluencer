# Engagement Quality Score Model — Development Plan

## Objective
Build the Engagement Quality Score module using `Top100.csv`.

This module will compute a 0–100 engagement score for influencer performance and support a backend service for the Ratefluencer platform.

## 1. EDA

- Confirm dataset shape and schema
- Inspect missing values and invalid entries
- Validate numeric ranges for `views`, `likes`, `comments`, `shares`, `duration_sec`, and `sentiment_score`
- Evaluate categorical cardinality for `category`, `language`, `region`, and `ads_enabled`
- Inspect the distribution of engagement ratios and top-performing videos

## 2. Feature Engineering

Derived features:

- `like_rate` = likes / views
- `comment_rate` = comments / views
- `share_rate` = shares / views
- `engagement_rate` = (likes + comments + shares) / views
- `sentiment_norm` = (sentiment_score + 1) / 2
- `duration_minutes` = duration_sec / 60
- `duration_norm` = tanh(duration_minutes / 10)

Other notes:

- Replace zero views with `NaN` before ratio computation
- Clip sentiment to [-1, 1]
- Encode `ads_enabled` as binary
- One-hot encode `category`, `language`, and `region`

## 3. Engagement Metrics

Primary output:

- `engagement_quality_score` on a 0–100 scale

Core metrics:

- Engagement rate
- Like rate
- Comment rate
- Share rate
- Sentiment quality
- Video duration signal

## 4. ML Approach

Planned approach:

1. Use derived engagement features to create an explicit video-quality score.
2. Build a `high_engagement` label using the upper engagement quantile (e.g. top 25%).
3. Train a model to classify videos as high versus normal engagement.
4. Persist the model for backend inference.

Suggested model:

- `RandomForestClassifier` with preprocessing pipeline
- Numeric scaling + categorical one-hot encoding
- Optional later upgrade: gradient boosting or explainable tree-based models

## 5. Score Generation (0–100)

Scoring design:

- Compute a normalized raw score from engagement ratios and sentiment
- Use weights such as:
  - 45% engagement rate
  - 20% like rate
  - 15% comment rate
  - 10% share rate
  - 10% sentiment quality
- Scale the normalized raw score to 0–100

The output field will be:

- `engagement_quality_score`

## 6. Backend Integration Strategy

Service contract:

- Expose a prediction endpoint in the backend, e.g. `POST /api/engagement-score`
- Input payload should contain video metadata:
  - `views`
  - `likes`
  - `comments`
  - `shares`
  - `duration_sec`
  - `sentiment_score`
  - `category`
  - `language`
  - `region`
  - `ads_enabled`
- Output should contain:
  - `engagement_quality_score`
  - `engagement_rate`
  - `predicted_high_engagement_probability`

Integration notes:

- Store the pretrained model artifact under the backend model directory
- Use a shared feature transformation pipeline for inference
- Ensure the backend returns a stable, reproducible score
- Provide a simple mapping for score bands:
  - 80–100: Excellent
  - 65–79 : Strong
  - 45–64 : Moderate
  - 25–44 : Weak
  - 0–24  : Poor

## Next step

1. Add `global_youtube_creator_data_large.csv` to the workspace.
2. Execute `engagement_model.py` to validate the pipeline and build the first model artifact.
3. Wire the model into the backend API once the dataset and artifact are available.
