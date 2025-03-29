docker run --rm --name builder \
    --user=$(id -u):$(id -g) \
    -v "$PWD":/workspace \
    docker.io/unfoldedcircle/r2-pyinstaller:3.11.6-0.2.0 \
    bash -c \
      "cd /workspace && \
      python -m pip install -r requirements.txt && \
      pyinstaller --clean --onedir --name fyta driver.py"


mkdir -p artifacts/bin
mv dist/fyta/* artifacts/bin
mv artifacts/bin/fyta artifacts/bin/driver
cp driver.json artifacts/
cp assets/fyta.png artifacts/
tar czvf uc-fyta-custom-aarch64.tar.gz -C artifacts .
rm -r dist build artifacts fyta.spec