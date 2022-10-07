const R = require('ramda')
const fs = require('fs')
const path = require('path')
const os = require('os')

const getYear = (monthLabel) => monthLabel.split('-')[2]

function countMonth(monthLabel) {
  const year = getYear(monthLabel)
  const filename = path.join(__dirname, '..', year, monthLabel + '.md')
  const file = fs.readFileSync(filename, 'utf8')

  const isTask = (line) => line.startsWith('- ')
  const hasTag = (line) => line.includes('@')
  const lines = file.split(os.EOL).filter(isTask).filter(hasTag)

  const lineToTagged = (line) => {
    const reg = /.* @(feature|process|learning|poc|blog|testing|devops)$/
    const matches = reg.exec(line)
    if (!matches) {
      throw new Error(`Invalid line "${line}"`)
    }

    return {
      line: matches[0].trim(),
      tag: matches[1].trim(),
    }
  }

  // console.log(lines)
  // console.log('%d lines', lines.length)

  const tags = lines.map(lineToTagged)
  // console.log(tags)
  // console.log(lines)
  // console.log('%d lines', lines.length)

  const grouped = R.groupBy(R.prop('tag'), tags)
  // console.log(grouped)
  const counted = {
    label: monthLabel,
  }
  Object.keys(grouped)
    .sort()
    .forEach((tag) => {
      counted[tag] = grouped[tag].length
    })
  // console.log(counted)

  return counted
}

const monthLabels = [
  '09-September-2021',
  '10-October-2021',
  '11-Nov-2021',
  '12-Dec-2021',
  '01-Jan-2022',
  '02-Feb-2022',
  '03-Mar-2022',
  '04-Apr-2022',
  '05-May-2022',
  '06-June-2022',
  '07-July-2022',
  '08-Aug-2022',
  '09-Sep-2022',
  '10-Oct-2022',
]

const tags = ['process', 'learning', 'poc', 'blog', 'testing', 'devops']

const calculateTotals = (counts) => {
  const totals = {
    label: 'total',
  }
  tags.forEach((tag) => {
    totals[tag] = 0
  })
  counts.forEach((count) => {
    tags.forEach((tag) => {
      const n = count[tag] || 0
      totals[tag] += n
    })
  })

  return totals
}

const calculateTotalPercent = (totals) => {
  const percents = {
    label: 'total %',
  }
  let totalN = 0
  tags.forEach((tag) => {
    totalN += totals[tag]
  })

  console.log('total items %d', totalN)

  tags.forEach((tag) => {
    percents[tag] = ((totals[tag] / totalN) * 100).toFixed(2)
  })

  return percents
}

const calculateAverage = (totals) => {
  const N = monthLabels.length
  const averages = {
    label: 'average',
  }
  tags.forEach((tag) => {
    averages[tag] = Math.round(totals[tag] / N)
  })

  return averages
}

const counts = monthLabels.map(countMonth)
const totals = calculateTotals(counts)
const totalPercents = calculateTotalPercent(totals)
const average = calculateAverage(totals)
counts.push(totals, totalPercents, average)
fs.writeFileSync('counted.json', JSON.stringify(counts, null, 2) + '\n', 'utf8')
console.log('wrote file counted.json')

let csvText = 'label,' + tags.join(',')
const toCsvLine = (count) => {
  return (
    count.label +
    ',' +
    tags
      .map((tag) => {
        const n = count[tag] || 0
        return String(n)
      })
      .join(',')
  )
}
csvText += '\n' + counts.map(toCsvLine).join('\n')

fs.writeFileSync('counted.csv', csvText + '\n', 'utf8')
console.log('wrote file counted.csv')

let mdText = '# Items counted\n'
mdText += 'label | ' + tags.join(' | ')
const toMdLine = (count) => {
  return (
    count.label +
    ' | ' +
    tags
      .map((tag) => {
        const n = count[tag] || 0
        return String(n)
      })
      .join(' | ')
  )
}
mdText += '\n---|' + tags.map((_) => '---').join('|') + '\n'
mdText += counts.map(toMdLine).join('\n')
fs.writeFileSync('counted.md', mdText + '\n', 'utf8')
console.log('wrote file counted.md')

// console.log(JSON.stringify(counts, null, 2))
console.log(JSON.stringify(totals, null, 2))
