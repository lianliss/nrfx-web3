FROM gcr.io/buildateam-52/nodejs:8.15.3

ENV NODE_ENV=${NODE_ENV} \
    STORAGE_BUCKET=${STORAGE_BUCKET} \
    CLOUD_BUCKET=${CLOUD_BUCKET}

COPY --chown=node ./ /home/node/app/
WORKDIR /home/node/app

USER node

RUN export NODE_OPTIONS=--max_old_space_size=4096;\
npm run reset
npm run start
