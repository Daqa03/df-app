import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oxsaaxehamevzfnxqefx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2FheGVoYW1ldnpmbnhxZWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ1NjIsImV4cCI6MjA5MjQ1MDU2Mn0.5J9func6UyhvBxt5XakKEQiQsXdUV5KO-7W4O8atXMQ'; 
// (Asegúrate de pegar tu clave completa arriba, yo la acorté aquí)

export const supabase = createClient(supabaseUrl, supabaseAnonKey);