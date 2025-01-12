FROM ubuntu:24.04

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create and activate virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy requirements and install Python dependencies
COPY requirements_cpu.txt .
RUN pip install --no-cache-dir -r requirements_cpu.txt

# Install FastAPI and Uvicorn
RUN pip install fastapi uvicorn

# Copy the project files
COPY . .

# Expose the service port
EXPOSE 5024

# Set the entry point to run the service
CMD ["uvicorn", "src.phishing_service:app", "--host", "0.0.0.0", "--port", "5024"]
