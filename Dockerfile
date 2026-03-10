FROM nginx:1.23.0

RUN apt-get update && apt-get upgrade -y

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

RUN                                                                       \
  apt-get install -y                                                      \
  libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3    \
  libxss1 libasound2 libxtst6 xauth xvfb g++ make
ENV export UPLOAD_TOKEN="SUFNSXJvbk1hbiEK"
WORKDIR /src/build-your-own-radar
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

COPY . ./
RUN chmod +x build_and_start_nginx.sh

# Override parent nginx image entrypoint so we run our script
ENTRYPOINT []
# Expose port 80 (map with -p 8080:80 when running to get http://localhost:8080)
EXPOSE 80
CMD ["./build_and_start_nginx.sh"]
