# Scheduler — Getting Started

## Clone and install

```bash
git clone https://github.com/Isabellaraskucasas/Scheduler.git
cd Scheduler
npm install
```

## Create your local data file

The `data/schedule.json` file is not in the repo — you need to create it:

```bash
echo '{ "people": [] }' > data/schedule.json
```

## Run the app

```bash
npm run dev
```

App runs at `http://localhost:3000`. Pages:
- `/student` — submit availability
- `/admin` — manage people
- `/schedule` — generate and view schedule

## Run tests

```bash
npm test
```

## Branching

Never commit directly to `main`. Always work on a branch:

```bash
git checkout -b your-branch-name   # create and switch to new branch
# make your changes, then:
git add .
git commit -m "description"
git push origin your-branch-name   # push to GitHub
```

Then open a Pull Request on GitHub to merge into `main`.
