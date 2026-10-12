FROM python:3.14.8-slim-trixie
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY processor.py /app/processor.py
USER 65532:65532
ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 8088
CMD ["python", "-I", "/app/processor.py"]
