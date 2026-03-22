import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

async function main() {
  console.log('Reading CSV...')
  const csvPath = path.join(process.cwd(), 'vizaura_courses_150.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const records = parse(raw, { columns: true, skip_empty_lines: true })

  console.log(`Found ${records.length} courses. Embedding and inserting...`)

  // Clear existing knowledge base
  await supabase.from('knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  let success = 0
  for (const row of records) {
    const content = [
      `Course: ${row.course_name}`,
      `Description: ${row.course_description}`,
      `Price: ₹${row.price}`,
      `Starting Date: ${row.starting_date}`,
      `Delivery Mode: ${row.delivery_mode}`,
      `Lessons: ${row.number_of_lessons} lessons, ${row.total_duration_hours} hours total`,
      `Target Audience: ${row.target_audience}`,
      `Link: ${row.course_link}`,
    ].join('\n')

    try {
      const embedding = await embed(content)
      const { error } = await supabase.from('knowledge_base').insert({
        course_name: row.course_name,
        content,
        embedding,
        metadata: {
          price: row.price,
          starting_date: row.starting_date,
          delivery_mode: row.delivery_mode,
          target_audience: row.target_audience,
          link: row.course_link,
        },
      })

      if (error) {
        console.error(`Error inserting ${row.course_name}:`, error.message)
      } else {
        success++
        process.stdout.write(`\r${success}/${records.length} embedded`)
      }
    } catch (err: any) {
      console.error(`Failed for ${row.course_name}:`, err.message)
    }
  }

  console.log(`\nDone! ${success}/${records.length} courses embedded into knowledge base.`)
}

main().catch(console.error)
