FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x docker-entrypoint.sh

# Collect static files at build time so WhiteNoise can serve them.
# SECRET_KEY is only needed by collectstatic for the manifest hash; it is not
# stored in the image and is overridden at runtime via the env file.
RUN SECRET_KEY=build-time-placeholder DEBUG=False python manage.py collectstatic --noinput

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "rentflow.wsgi:application", "--config", "gunicorn.conf.py"]
