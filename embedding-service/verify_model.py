from __future__ import annotations

import numpy as np

from app import MODEL_DIMENSIONS, MODEL_NAME, load_model


def main() -> None:
    model = load_model()
    vectors = model.encode(
        ["오늘은 SoriTarae의 임베딩 기능을 확인했다."],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    dimensions = int(vectors.shape[1])
    vector_norm = float(np.linalg.norm(vectors[0]))
    if dimensions != MODEL_DIMENSIONS:
        raise RuntimeError(
            f"Expected {MODEL_DIMENSIONS} dimensions, received {dimensions}."
        )

    print(f"model={MODEL_NAME}")
    print(f"dimensions={dimensions}")
    print(f"normalized={abs(vector_norm - 1.0) < 0.0001}")


if __name__ == "__main__":
    main()
