/*
 * 将三上 Join in 单词表整理为「每项至多三个单词」的资源导入清单。
 * 生成的图片和清单均为本机临时文件，不进入代码仓库。
 */
const fs = require('fs')
const path = require('path')

const targetDirectory = path.join(process.cwd(), 'tmp', 'joinin-spelling-cards')
const manifestFile = path.join(process.cwd(), '.resource-import.local.json')
const units = [
  ['Welcome', 1000, 'let|begin|join|in|English|be (am, is, are)|easy|come|come on|and|you|ready|kid|yeah|OK|listen|sing|speak|act|draw|look|guess|write|think|read|colour|play|hello'],
  ['Unit 1', 2000, 'what|your|name|I|go|we|all|love|a (an)|clever|bird|him|good|morning|good morning|goodbye (bye)|night|this|nice|to|meet|happy|birthday|happy birthday|afternoon|Ms|how|today|too|fine|children|cut|my|hi|dear|at|butterfly|lovely|little|bye-bye|favourite|no|yes|that|right'],
  ['Unit 2', 3000, 'colourful|world|red|pink|yellow|orange|green|brown|black|blue|white|purple|the|rainbow|it|oh|start|necklace|for|mum|old|can|paint|only|me|thank'],
  ['Unit 3', 4000, 'number|fun|tiger|jump|do|ten|nine|eight|seven|six|five|four|three|two|one|duck|show|about|be about to do sth|dad|please|hurry|up|hurry up|wrong|see|many|how many|get|out|get out|have|have a look|help|great|late|safe|call'],
  ['Unit 4', 5000, 'school|thing|pencil|case|pencil case|pen|eraser|schoolbag|ruler|book|home|where|picture|on|wall|paper|open|take|take out|rope|skipping rope'],
  ['Unit 5', 6000, 'classroom|blackboard|door|window|desk|chair|floor|ball|behind|front|of|in front of|beside|under|now|class|wow|next|keep|with|over|clean|sweep|put|tomorrow|they'],
  ['Unit 6', 7000, 'family|brother|sister|grandpa|grandma|some|tea|uncle|aunt|long|time|sport|day|sports day|their|dog|win|best|job|good job|all right|well|well done|he|she|grandfather|mother|grandmother|father|who|cousin|her'],
  ['Plays', 8000, 'magic|paintbrush|like|dream|man|boy|fly|dog|woof|run|girl|hungry|noodle|cold|coat|emperor|hear|want|money|tree|island|sea|ship|wind|more|fall|into|after|use|his|give|pear|year|big|welcome|juicy|sweet|beautiful|small|eat|very|kind']
]

const groups = []
units.forEach(([label, sortBase, raw]) => {
  const words = raw.split('|')
  for (let index = 0; index < words.length; index += 3) {
    const taskNumber = Math.floor(index / 3) + 1
    groups.push({
      label,
      unit: sortBase + taskNumber,
      title: `${label} · 拼写任务 ${String(taskNumber).padStart(2, '0')}`,
      words: words.slice(index, index + 3)
    })
  }
})

fs.mkdirSync(targetDirectory, { recursive: true })
const manifest = {
  library: { id: 'english', label: '英语资料库' },
  category: { id: 'joinin-grade3-spelling', label: '三上单词拼写任务' },
  resources: groups.map((group, index) => ({
    file: path.join(targetDirectory, `${String(index + 1).padStart(3, '0')}.png`),
    title: group.title,
    content: group.words.join('\n'),
    unit: group.unit
  }))
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8')
fs.writeFileSync(path.join(targetDirectory, 'cards.json'), JSON.stringify(groups, null, 2), 'utf8')
console.log(`已生成 ${groups.length} 个任务清单：${manifestFile}`)
