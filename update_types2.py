with open(r'C:\Users\shubi\OneDrive\Desktop\Impetus\src\lib\supabase\database.types.ts', 'r') as f:
    content = f.read()

old = '''          isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_test_benchmarks: {'''

new = '''          isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_strength_benchmarks: {
        Row: {
          age_band_id: string
          higher_is_better: boolean
          id: string
          score_2_boundary: number
          score_3_boundary: number
          score_4_boundary: number
          score_5_boundary: number | null
          test_id: string
          updated_at: string
        }
        Insert: {
          age_band_id: string
          higher_is_better: boolean
          id?: string
          score_2_boundary: number
          score_3_boundary: number
          score_4_boundary: number
          score_5_boundary?: number | null
          test_id: string
          updated_at?: string
        }
        Update: {
          age_band_id?: string
          higher_is_better?: boolean
          id?: string
          score_2_boundary?: number
          score_3_boundary?: number
          score_4_boundary?: number
          score_5_boundary?: number | null
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_strength_benchmarks_age_band_id_fkey"
            columns: ["age_band_id"]
            isOneToOne: false
            referencedRelation: "five_s_age_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "five_s_strength_benchmarks_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "five_s_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      five_s_test_benchmarks: {'''

if old in content:
    content = content.replace(old, new)
    with open(r'C:\Users\shubi\OneDrive\Desktop\Impetus\src\lib\supabase\database.types.ts', 'w') as f:
        f.write(content)
    print('Done')
else:
    print('Not found')