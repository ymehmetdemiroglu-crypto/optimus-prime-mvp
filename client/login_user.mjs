import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://njexkrepeazbtlwckakk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZXhrcmVwZWF6YnRsd2NrYWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODYwOTMsImV4cCI6MjA4Nzk2MjA5M30.pKjgQB_queaSdakbdK26ICxKyOTzFgaRwK0e1fbVohY')

async function login() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'ymehmetdemiroglu@gmail.com',
        password: 'password123'
    })
    console.log("Data:", data)
    console.log("Error:", error)
}
login()
