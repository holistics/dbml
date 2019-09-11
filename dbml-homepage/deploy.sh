#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd docs/.vuepress/dist

# if you are deploying to a custom domain
echo 'www.dbml.org' > CNAME

cp "home/index.html" "./"

git init
git remote add origin https://github.com/holistics/dbml.git
git checkout -b gh-pages
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io
# git push -f git@github.com:<USERNAME>/<USERNAME>.github.io.git master

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f https://github.com/holistics/dbml-homepage.git gh-pages

# cd -
