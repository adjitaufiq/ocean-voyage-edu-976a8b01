export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acquisition_events: {
        Row: {
          campaign: string | null
          channel: string | null
          created_at: string
          device_type: string | null
          event: string
          id: string
          label: string | null
          landing_page: string | null
          path: string | null
          session_id: string | null
          source: string | null
          visitor_id: string
        }
        Insert: {
          campaign?: string | null
          channel?: string | null
          created_at?: string
          device_type?: string | null
          event: string
          id?: string
          label?: string | null
          landing_page?: string | null
          path?: string | null
          session_id?: string | null
          source?: string | null
          visitor_id: string
        }
        Update: {
          campaign?: string | null
          channel?: string | null
          created_at?: string
          device_type?: string | null
          event?: string
          id?: string
          label?: string | null
          landing_page?: string | null
          path?: string | null
          session_id?: string | null
          source?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          budget: string | null
          business_category: string | null
          complexity: string | null
          contact_email: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          created_at: string
          features: Json
          id: string
          intent: string
          lead_id: string | null
          message_count: number
          messages: Json
          package_name: string | null
          problems: Json
          qualified_at: string | null
          requirements: Json
          score: number
          session_id: string
          status: string
          summary: string | null
          timeline: string | null
          updated_at: string
          users_scale: string | null
        }
        Insert: {
          budget?: string | null
          business_category?: string | null
          complexity?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          features?: Json
          id?: string
          intent?: string
          lead_id?: string | null
          message_count?: number
          messages?: Json
          package_name?: string | null
          problems?: Json
          qualified_at?: string | null
          requirements?: Json
          score?: number
          session_id: string
          status?: string
          summary?: string | null
          timeline?: string | null
          updated_at?: string
          users_scale?: string | null
        }
        Update: {
          budget?: string | null
          business_category?: string | null
          complexity?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          features?: Json
          id?: string
          intent?: string
          lead_id?: string | null
          message_count?: number
          messages?: Json
          package_name?: string | null
          problems?: Json
          qualified_at?: string | null
          requirements?: Json
          score?: number
          session_id?: string
          status?: string
          summary?: string | null
          timeline?: string | null
          updated_at?: string
          users_scale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      apify_runs: {
        Row: {
          actor: string
          candidate_id: string | null
          created_at: string
          created_by: string | null
          dataset_id: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input: Json
          item_count: number
          run_id: string | null
          source_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor: string
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json
          item_count?: number
          run_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor?: string
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json
          item_count?: number
          run_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apify_runs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_daily_briefs: {
        Row: {
          brief_date: string
          chat_id: string
          created_at: string
          error: string | null
          id: string
          message: string
          scheduled_for: string | null
          sent_at: string
          status: string
          timezone: string
          trigger_source: string
        }
        Insert: {
          brief_date: string
          chat_id: string
          created_at?: string
          error?: string | null
          id?: string
          message: string
          scheduled_for?: string | null
          sent_at?: string
          status?: string
          timezone?: string
          trigger_source?: string
        }
        Update: {
          brief_date?: string
          chat_id?: string
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          scheduled_for?: string | null
          sent_at?: string
          status?: string
          timezone?: string
          trigger_source?: string
        }
        Relationships: []
      }
      assistant_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          importance: number
          provenance: string
          source_thread_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          provenance?: string
          source_thread_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          provenance?: string
          source_thread_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_memories_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          client_message_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          parts: Json
          role: string
          thread_id: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          parts?: Json
          role: string
          thread_id: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_owner_tasks: {
        Row: {
          chat_id: string | null
          completed_at: string | null
          created_at: string
          detail: string | null
          due_date: string | null
          id: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          chat_id?: string | null
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_pending_actions: {
        Row: {
          action_type: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          origin: string
          payload: Json
          payload_hash: string
          requested_by: string
          result: string | null
          status: string
          summary: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          origin?: string
          payload?: Json
          payload_hash: string
          requested_by: string
          result?: string | null
          status?: string
          summary: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          origin?: string
          payload?: Json
          payload_hash?: string
          requested_by?: string
          result?: string | null
          status?: string
          summary?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assistant_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          category: string
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string | null
          event: string
          id: string
          meta: Json
          rule_key: string
          status: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event: string
          id?: string
          meta?: Json
          rule_key: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event?: string
          id?: string
          meta?: Json
          rule_key?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_tasks: {
        Row: {
          assignee: string | null
          client_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          detail: string | null
          due_at: string
          id: string
          invoice_id: string | null
          kind: string
          lead_id: string | null
          meta: Json
          priority: string
          project_id: string | null
          proposal_id: string | null
          rule_key: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string
          id?: string
          invoice_id?: string | null
          kind: string
          lead_id?: string | null
          meta?: Json
          priority?: string
          project_id?: string | null
          proposal_id?: string | null
          rule_key: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          client_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          lead_id?: string | null
          meta?: Json
          priority?: string
          project_id?: string | null
          proposal_id?: string | null
          rule_key?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_tasks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_consultant_analyses: {
        Row: {
          business_entity_id: string
          business_model: Json
          business_stage: Json
          confidence: number | null
          confirmed_problems: Json
          consultant_reasoning: Json
          core_solution: Json
          created_at: string
          engine_version: string | null
          generated_at: string | null
          id: string
          industry_context: Json
          input_hash: string | null
          knowledge_version: string | null
          objection_guidance: Json
          observed_facts: Json
          optional_features: Json
          problem_hypotheses: Json
          recommended_features: Json
          recommended_package: Json
          sales_angle: Json
          source_revision: number
          status: Database["public"]["Enums"]["business_analysis_status"]
          superseded_at: string | null
          updated_at: string
          validation_questions: Json
          version: number
        }
        Insert: {
          business_entity_id: string
          business_model?: Json
          business_stage?: Json
          confidence?: number | null
          confirmed_problems?: Json
          consultant_reasoning?: Json
          core_solution?: Json
          created_at?: string
          engine_version?: string | null
          generated_at?: string | null
          id?: string
          industry_context?: Json
          input_hash?: string | null
          knowledge_version?: string | null
          objection_guidance?: Json
          observed_facts?: Json
          optional_features?: Json
          problem_hypotheses?: Json
          recommended_features?: Json
          recommended_package?: Json
          sales_angle?: Json
          source_revision?: number
          status?: Database["public"]["Enums"]["business_analysis_status"]
          superseded_at?: string | null
          updated_at?: string
          validation_questions?: Json
          version?: number
        }
        Update: {
          business_entity_id?: string
          business_model?: Json
          business_stage?: Json
          confidence?: number | null
          confirmed_problems?: Json
          consultant_reasoning?: Json
          core_solution?: Json
          created_at?: string
          engine_version?: string | null
          generated_at?: string | null
          id?: string
          industry_context?: Json
          input_hash?: string | null
          knowledge_version?: string | null
          objection_guidance?: Json
          observed_facts?: Json
          optional_features?: Json
          problem_hypotheses?: Json
          recommended_features?: Json
          recommended_package?: Json
          sales_angle?: Json
          source_revision?: number
          status?: Database["public"]["Enums"]["business_analysis_status"]
          superseded_at?: string | null
          updated_at?: string
          validation_questions?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_consultant_analyses_business_entity_id_fkey"
            columns: ["business_entity_id"]
            isOneToOne: false
            referencedRelation: "business_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      business_entities: {
        Row: {
          address: string | null
          business_model: string | null
          canonical_name: string
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          current_analysis_id: string | null
          current_stage: string
          email: string | null
          google_place_id: string | null
          id: string
          industry: string | null
          normalized_name: string | null
          phone: string | null
          province: string | null
          source_revision: number
          updated_at: string
          website: string | null
          website_domain: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_model?: string | null
          canonical_name: string
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_analysis_id?: string | null
          current_stage?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          industry?: string | null
          normalized_name?: string | null
          phone?: string | null
          province?: string | null
          source_revision?: number
          updated_at?: string
          website?: string | null
          website_domain?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_model?: string | null
          canonical_name?: string
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_analysis_id?: string | null
          current_stage?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          industry?: string | null
          normalized_name?: string | null
          phone?: string | null
          province?: string | null
          source_revision?: number
          updated_at?: string
          website?: string | null
          website_domain?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_entities_current_analysis_fk"
            columns: ["current_analysis_id"]
            isOneToOne: false
            referencedRelation: "business_consultant_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_entity_links: {
        Row: {
          business_entity_id: string
          created_at: string
          id: string
          is_active: boolean
          legacy_id: string
          legacy_type: Database["public"]["Enums"]["business_legacy_type"]
        }
        Insert: {
          business_entity_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_id: string
          legacy_type: Database["public"]["Enums"]["business_legacy_type"]
        }
        Update: {
          business_entity_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_id?: string
          legacy_type?: Database["public"]["Enums"]["business_legacy_type"]
        }
        Relationships: [
          {
            foreignKeyName: "business_entity_links_business_entity_id_fkey"
            columns: ["business_entity_id"]
            isOneToOne: false
            referencedRelation: "business_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      business_findings: {
        Row: {
          analysis_id: string | null
          business_entity_id: string
          confidence: number | null
          created_at: string
          evidence_reference: Json
          id: string
          kind: Database["public"]["Enums"]["business_finding_kind"]
          source_type: string | null
          statement: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["business_finding_validation"]
        }
        Insert: {
          analysis_id?: string | null
          business_entity_id: string
          confidence?: number | null
          created_at?: string
          evidence_reference?: Json
          id?: string
          kind: Database["public"]["Enums"]["business_finding_kind"]
          source_type?: string | null
          statement: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["business_finding_validation"]
        }
        Update: {
          analysis_id?: string | null
          business_entity_id?: string
          confidence?: number | null
          created_at?: string
          evidence_reference?: Json
          id?: string
          kind?: Database["public"]["Enums"]["business_finding_kind"]
          source_type?: string | null
          statement?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["business_finding_validation"]
        }
        Relationships: [
          {
            foreignKeyName: "business_findings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "business_consultant_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_findings_business_entity_id_fkey"
            columns: ["business_entity_id"]
            isOneToOne: false
            referencedRelation: "business_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_sources: {
        Row: {
          candidate_id: string
          confidence_score: number
          created_at: string
          external_id: string | null
          fetched_at: string
          id: string
          normalized_data: Json
          provider: string
          raw_payload: Json
          source_type: string
          source_url: string | null
          status: string
        }
        Insert: {
          candidate_id: string
          confidence_score?: number
          created_at?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          normalized_data?: Json
          provider: string
          raw_payload?: Json
          source_type: string
          source_url?: string | null
          status?: string
        }
        Update: {
          candidate_id?: string
          confidence_score?: number
          created_at?: string
          external_id?: string | null
          fetched_at?: string
          id?: string
          normalized_data?: Json
          provider?: string
          raw_payload?: Json
          source_type?: string
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_sources_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_status_history: {
        Row: {
          actor_id: string | null
          actor_kind: string
          actor_label: string | null
          candidate_id: string
          created_at: string
          from_status: string | null
          id: string
          meta: Json
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          actor_label?: string | null
          candidate_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          meta?: Json
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          actor_label?: string | null
          candidate_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          meta?: Json
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_status_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invoice_id: string | null
          kind: string
          proposal_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          proposal_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          proposal_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          author_name: string | null
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          sender: string
        }
        Insert: {
          author_name?: string | null
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          sender?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_projects: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invoice_id: string | null
          name: string
          phase: string
          progress: number
          scope: string | null
          stage: string
          start_date: string | null
          status: string
          summary: string | null
          target_date: string | null
          team: Json
          template: string
          timeline: Json
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          name: string
          phase?: string
          progress?: number
          scope?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          summary?: string | null
          target_date?: string | null
          team?: Json
          template?: string
          timeline?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          name?: string
          phase?: string
          progress?: number
          scope?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          summary?: string | null
          target_date?: string | null
          team?: Json
          template?: string
          timeline?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          converted_at: string
          created_at: string
          email: string
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          package: string | null
          portal_token: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company?: string | null
          converted_at?: string
          created_at?: string
          email: string
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          package?: string | null
          portal_token?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company?: string | null
          converted_at?: string
          created_at?: string
          email?: string
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          package?: string | null
          portal_token?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          admin_notes: string | null
          ai_business_category: string | null
          ai_complexity: string | null
          ai_conversation: Json
          ai_lead_score: number
          ai_problems: Json
          ai_qualification_status: string | null
          ai_recommended_package: string | null
          ai_requirements: Json
          ai_summary: string | null
          archived_at: string | null
          budget: string
          business_name: string | null
          clicked_ctas: Json
          company: string | null
          conversion_surface: string | null
          created_at: string
          device_type: string | null
          email: string
          features: string | null
          first_content_path: string | null
          first_content_title: string | null
          first_touch_at: string | null
          first_touch_channel: string | null
          first_touch_landing_page: string | null
          first_touch_referrer: string | null
          first_touch_source: string | null
          id: string
          journey: Json
          landing_page: string | null
          last_touch_channel: string | null
          last_touch_page: string | null
          last_touch_source: string | null
          lead_score: number
          lead_source: string
          lead_temperature: string
          name: string
          notes: string | null
          project_type: string
          referrer: string | null
          requirement: string
          selected_package: string | null
          status: string
          status_updated_at: string
          timeline: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          viewed_products: Json
          visit_duration_seconds: number
          visited_pages: Json
          visitor_id: string | null
          visitor_source: string | null
          whatsapp: string
        }
        Insert: {
          admin_notes?: string | null
          ai_business_category?: string | null
          ai_complexity?: string | null
          ai_conversation?: Json
          ai_lead_score?: number
          ai_problems?: Json
          ai_qualification_status?: string | null
          ai_recommended_package?: string | null
          ai_requirements?: Json
          ai_summary?: string | null
          archived_at?: string | null
          budget: string
          business_name?: string | null
          clicked_ctas?: Json
          company?: string | null
          conversion_surface?: string | null
          created_at?: string
          device_type?: string | null
          email: string
          features?: string | null
          first_content_path?: string | null
          first_content_title?: string | null
          first_touch_at?: string | null
          first_touch_channel?: string | null
          first_touch_landing_page?: string | null
          first_touch_referrer?: string | null
          first_touch_source?: string | null
          id?: string
          journey?: Json
          landing_page?: string | null
          last_touch_channel?: string | null
          last_touch_page?: string | null
          last_touch_source?: string | null
          lead_score?: number
          lead_source?: string
          lead_temperature?: string
          name: string
          notes?: string | null
          project_type: string
          referrer?: string | null
          requirement: string
          selected_package?: string | null
          status?: string
          status_updated_at?: string
          timeline: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewed_products?: Json
          visit_duration_seconds?: number
          visited_pages?: Json
          visitor_id?: string | null
          visitor_source?: string | null
          whatsapp: string
        }
        Update: {
          admin_notes?: string | null
          ai_business_category?: string | null
          ai_complexity?: string | null
          ai_conversation?: Json
          ai_lead_score?: number
          ai_problems?: Json
          ai_qualification_status?: string | null
          ai_recommended_package?: string | null
          ai_requirements?: Json
          ai_summary?: string | null
          archived_at?: string | null
          budget?: string
          business_name?: string | null
          clicked_ctas?: Json
          company?: string | null
          conversion_surface?: string | null
          created_at?: string
          device_type?: string | null
          email?: string
          features?: string | null
          first_content_path?: string | null
          first_content_title?: string | null
          first_touch_at?: string | null
          first_touch_channel?: string | null
          first_touch_landing_page?: string | null
          first_touch_referrer?: string | null
          first_touch_source?: string | null
          id?: string
          journey?: Json
          landing_page?: string | null
          last_touch_channel?: string | null
          last_touch_page?: string | null
          last_touch_source?: string | null
          lead_score?: number
          lead_source?: string
          lead_temperature?: string
          name?: string
          notes?: string | null
          project_type?: string
          referrer?: string | null
          requirement?: string
          selected_package?: string | null
          status?: string
          status_updated_at?: string
          timeline?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewed_products?: Json
          visit_duration_seconds?: number
          visited_pages?: Json
          visitor_id?: string | null
          visitor_source?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      conversation_requirements: {
        Row: {
          budget: string | null
          business: string
          change_note: string | null
          contact_email: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          features: Json
          final_prompt: string | null
          id: string
          intent: string
          lead_id: string | null
          package_name: string | null
          problems: Json
          project: string
          score: number
          source: string
          summary: string | null
          timeline: string | null
          users_scale: string | null
          version: number
        }
        Insert: {
          budget?: string | null
          business?: string
          change_note?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string | null
          features?: Json
          final_prompt?: string | null
          id?: string
          intent?: string
          lead_id?: string | null
          package_name?: string | null
          problems?: Json
          project?: string
          score?: number
          source?: string
          summary?: string | null
          timeline?: string | null
          users_scale?: string | null
          version: number
        }
        Update: {
          budget?: string | null
          business?: string
          change_note?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          features?: Json
          final_prompt?: string | null
          id?: string
          intent?: string
          lead_id?: string | null
          package_name?: string | null
          problems?: Json
          project?: string
          score?: number
          source?: string
          summary?: string | null
          timeline?: string | null
          users_scale?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_requirements_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_requirements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_tasks: {
        Row: {
          area: string
          attempt: number
          campaign_id: string
          created_at: string
          created_by: string | null
          duplicate_count: number
          found_count: number
          id: string
          keyword: string
          last_error: string | null
          last_run_at: string | null
          latitude: number | null
          locked_at: string | null
          longitude: number | null
          max_attempts: number
          page_token: string | null
          radius_meters: number
          rejected_count: number
          saved_count: number
          status: string
          updated_at: string
        }
        Insert: {
          area: string
          attempt?: number
          campaign_id: string
          created_at?: string
          created_by?: string | null
          duplicate_count?: number
          found_count?: number
          id?: string
          keyword: string
          last_error?: string | null
          last_run_at?: string | null
          latitude?: number | null
          locked_at?: string | null
          longitude?: number | null
          max_attempts?: number
          page_token?: string | null
          radius_meters?: number
          rejected_count?: number
          saved_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string
          attempt?: number
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          duplicate_count?: number
          found_count?: number
          id?: string
          keyword?: string
          last_error?: string | null
          last_run_at?: string | null
          latitude?: number | null
          locked_at?: string | null
          longitude?: number | null
          max_attempts?: number
          page_token?: string | null
          radius_meters?: number
          rejected_count?: number
          saved_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospect_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_usage_daily: {
        Row: {
          errors: number
          provider: string
          requests: number
          results: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          errors?: number
          provider: string
          requests?: number
          results?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          errors?: number
          provider?: string
          requests?: number
          results?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      document_links: {
        Row: {
          bucket: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          kind: string
          lead_id: string | null
          path: string
          slug: string
          updated_at: string
        }
        Insert: {
          bucket?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          kind?: string
          lead_id?: string | null
          path: string
          slug: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          kind?: string
          lead_id?: string | null
          path?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_match_candidates: {
        Row: {
          created_at: string
          entity_kind: string
          id: string
          match_reason: Json
          prospect_a: string
          prospect_b: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          similarity_score: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_kind?: string
          id?: string
          match_reason?: Json
          prospect_a: string
          prospect_b: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          similarity_score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_kind?: string
          id?: string
          match_reason?: Json
          prospect_a?: string
          prospect_b?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          similarity_score?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_match_history: {
        Row: {
          candidate_entity_id: string | null
          comparison: Json
          confidence_score: number
          created_at: string
          id: string
          matched_entity_id: string | null
          matching_method: string
          reason: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["business_legacy_type"]
          status: string
        }
        Insert: {
          candidate_entity_id?: string | null
          comparison?: Json
          confidence_score?: number
          created_at?: string
          id?: string
          matched_entity_id?: string | null
          matching_method: string
          reason?: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["business_legacy_type"]
          status?: string
        }
        Update: {
          candidate_entity_id?: string | null
          comparison?: Json
          confidence_score?: number
          created_at?: string
          id?: string
          matched_entity_id?: string | null
          matching_method?: string
          reason?: string | null
          source_id?: string
          source_type?: Database["public"]["Enums"]["business_legacy_type"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_match_history_candidate_entity_id_fkey"
            columns: ["candidate_entity_id"]
            isOneToOne: false
            referencedRelation: "business_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_match_history_matched_entity_id_fkey"
            columns: ["matched_entity_id"]
            isOneToOne: false
            referencedRelation: "business_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_company: string | null
          client_email: string | null
          client_name: string | null
          client_whatsapp: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          items: Json
          lead_id: string
          notes: string | null
          number: string
          optional_items: Json
          package: string | null
          paid_amount: number
          paid_at: string | null
          payment_link: string | null
          payment_type: string
          project_name: string | null
          proposal_id: string | null
          provider: string
          provider_reference: string | null
          schedule: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          items?: Json
          lead_id: string
          notes?: string | null
          number: string
          optional_items?: Json
          package?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_link?: string | null
          payment_type?: string
          project_name?: string | null
          proposal_id?: string | null
          provider?: string
          provider_reference?: string | null
          schedule?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          items?: Json
          lead_id?: string
          notes?: string | null
          number?: string
          optional_items?: Json
          package?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_link?: string | null
          payment_type?: string
          project_name?: string | null
          proposal_id?: string | null
          provider?: string
          provider_reference?: string | null
          schedule?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ai_activities: {
        Row: {
          action: string
          content: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          label: string | null
          lead_id: string
          meta: Json
        }
        Insert: {
          action: string
          content: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label?: string | null
          lead_id: string
          meta?: Json
        }
        Update: {
          action?: string
          content?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label?: string | null
          lead_id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          category: string
          client_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          features: Json
          gallery: Json
          id: string
          og_image: string | null
          position: number
          problem: string | null
          published: boolean
          result: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          solution: string | null
          tech_stack: Json
          testimonial_author: string | null
          testimonial_quote: string | null
          testimonial_role: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          id?: string
          og_image?: string | null
          position?: number
          problem?: string | null
          published?: boolean
          result?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          solution?: string | null
          tech_stack?: Json
          testimonial_author?: string | null
          testimonial_quote?: string | null
          testimonial_role?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          id?: string
          og_image?: string | null
          position?: number
          problem?: string | null
          published?: boolean
          result?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          solution?: string | null
          tech_stack?: Json
          testimonial_author?: string | null
          testimonial_quote?: string | null
          testimonial_role?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          action: string
          actor: string
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          project_id: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          project_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          position: number
          priority: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          brief_timeline: string | null
          content: Json
          core_features: Json
          created_at: string
          created_by: string | null
          enhancements: Json
          estimated_timeline: string | null
          id: string
          investment_note: string | null
          note: string | null
          payment_dp_percent: number | null
          payment_terms_text: string | null
          payment_type: string
          pricing_items: Json
          proposal_id: string
          recommended_package: string | null
          timeline_note: string | null
          title: string
          version: number
        }
        Insert: {
          brief_timeline?: string | null
          content?: Json
          core_features?: Json
          created_at?: string
          created_by?: string | null
          enhancements?: Json
          estimated_timeline?: string | null
          id?: string
          investment_note?: string | null
          note?: string | null
          payment_dp_percent?: number | null
          payment_terms_text?: string | null
          payment_type?: string
          pricing_items?: Json
          proposal_id: string
          recommended_package?: string | null
          timeline_note?: string | null
          title: string
          version: number
        }
        Update: {
          brief_timeline?: string | null
          content?: Json
          core_features?: Json
          created_at?: string
          created_by?: string | null
          enhancements?: Json
          estimated_timeline?: string | null
          id?: string
          investment_note?: string | null
          note?: string | null
          payment_dp_percent?: number | null
          payment_terms_text?: string | null
          payment_type?: string
          pricing_items?: Json
          proposal_id?: string
          recommended_package?: string | null
          timeline_note?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          brief_timeline: string | null
          client_name: string | null
          content: Json
          core_features: Json
          created_at: string
          created_by: string | null
          currency: string
          enhancements: Json
          estimated_timeline: string | null
          id: string
          investment_note: string | null
          lead_id: string
          payment_dp_percent: number | null
          payment_terms_text: string | null
          payment_type: string
          pricing_items: Json
          recommended_package: string | null
          rejected_at: string | null
          sent_at: string | null
          status: string
          timeline_note: string | null
          title: string
          updated_at: string
          valid_until: string | null
          version: number
          viewed_at: string | null
        }
        Insert: {
          approved_at?: string | null
          brief_timeline?: string | null
          client_name?: string | null
          content?: Json
          core_features?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          enhancements?: Json
          estimated_timeline?: string | null
          id?: string
          investment_note?: string | null
          lead_id: string
          payment_dp_percent?: number | null
          payment_terms_text?: string | null
          payment_type?: string
          pricing_items?: Json
          recommended_package?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          timeline_note?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Update: {
          approved_at?: string | null
          brief_timeline?: string | null
          client_name?: string | null
          content?: Json
          core_features?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          enhancements?: Json
          estimated_timeline?: string | null
          id?: string
          investment_note?: string | null
          lead_id?: string
          payment_dp_percent?: number | null
          payment_terms_text?: string | null
          payment_type?: string
          pricing_items?: Json
          recommended_package?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          timeline_note?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_activities: {
        Row: {
          action: string
          content: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          label: string | null
          meta: Json
          prospect_id: string
        }
        Insert: {
          action: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label?: string | null
          meta?: Json
          prospect_id: string
        }
        Update: {
          action?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label?: string | null
          meta?: Json
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_audits: {
        Row: {
          accurate: boolean | null
          ai_claims: Json
          ai_stage: string | null
          batch_key: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          findings: Json
          id: string
          prospect_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          reviewer_notes: string | null
          reviewer_verdict: string | null
        }
        Insert: {
          accurate?: boolean | null
          ai_claims?: Json
          ai_stage?: string | null
          batch_key?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          findings?: Json
          id?: string
          prospect_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          reviewer_notes?: string | null
          reviewer_verdict?: string | null
        }
        Update: {
          accurate?: boolean | null
          ai_claims?: Json
          ai_stage?: string | null
          batch_key?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          findings?: Json
          id?: string
          prospect_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          reviewer_notes?: string | null
          reviewer_verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_audits_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospect_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_audits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_campaigns: {
        Row: {
          areas: Json
          created_at: string
          created_by: string | null
          custom_solutions: Json
          daily_target: number
          discovery_provider: string
          enrichment_budget_daily: number
          id: string
          industry: string
          keywords: Json
          last_run_at: string | null
          latitude: number | null
          location: string
          longitude: number | null
          name: string
          needs_review: boolean
          notes: string | null
          pipeline_version: string
          primary_solution: string | null
          radius_meters: number
          review_reason: string | null
          solution: string
          solutions: Json
          status: string
          target_candidates: number
          target_categories: Json
          total_discovered: number
          updated_at: string
          validation_accuracy: number | null
        }
        Insert: {
          areas?: Json
          created_at?: string
          created_by?: string | null
          custom_solutions?: Json
          daily_target?: number
          discovery_provider?: string
          enrichment_budget_daily?: number
          id?: string
          industry: string
          keywords?: Json
          last_run_at?: string | null
          latitude?: number | null
          location: string
          longitude?: number | null
          name: string
          needs_review?: boolean
          notes?: string | null
          pipeline_version?: string
          primary_solution?: string | null
          radius_meters?: number
          review_reason?: string | null
          solution: string
          solutions?: Json
          status?: string
          target_candidates?: number
          target_categories?: Json
          total_discovered?: number
          updated_at?: string
          validation_accuracy?: number | null
        }
        Update: {
          areas?: Json
          created_at?: string
          created_by?: string | null
          custom_solutions?: Json
          daily_target?: number
          discovery_provider?: string
          enrichment_budget_daily?: number
          id?: string
          industry?: string
          keywords?: Json
          last_run_at?: string | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          name?: string
          needs_review?: boolean
          notes?: string | null
          pipeline_version?: string
          primary_solution?: string | null
          radius_meters?: number
          review_reason?: string | null
          solution?: string
          solutions?: Json
          status?: string
          target_candidates?: number
          target_categories?: Json
          total_discovered?: number
          updated_at?: string
          validation_accuracy?: number | null
        }
        Relationships: []
      }
      prospect_candidate_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          actor_label: string | null
          candidate_id: string
          created_at: string
          data_source: string | null
          data_source_url: string | null
          event: string
          field: string | null
          id: string
          meta: Json
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          actor_label?: string | null
          candidate_id: string
          created_at?: string
          data_source?: string | null
          data_source_url?: string | null
          event: string
          field?: string | null
          id?: string
          meta?: Json
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          actor_label?: string | null
          candidate_id?: string
          created_at?: string
          data_source?: string | null
          data_source_url?: string | null
          event?: string
          field?: string | null
          id?: string
          meta?: Json
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_candidate_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_candidates: {
        Row: {
          address: string | null
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_email: string | null
          auto_qc_reason: string | null
          business_name: string
          business_name_normalized: string | null
          buying_signal_hypothesis: string | null
          campaign_id: string | null
          candidate_status: string
          category: string | null
          city: string | null
          confidence_score: number | null
          contact_data: Json
          contact_stage: string | null
          country: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          digital_gap: string | null
          discovery_method: string
          discovery_query: string | null
          discovery_reason: string | null
          discovery_source: string | null
          discovery_task_id: string | null
          duplicate_confidence: number | null
          duplicate_detected_at: string | null
          duplicate_of: string | null
          duplicate_reason: string | null
          duplicate_status: string
          google_maps_url: string | null
          icp_reason: string | null
          icp_score: number
          id: string
          industry: string | null
          latitude: number | null
          lead_reason: string | null
          lead_score: number
          lead_temperature: string
          longitude: number | null
          opening_hours: Json
          pain_signal: string | null
          permanently_closed: boolean
          phone: string | null
          place_id: string | null
          postal_code: string | null
          potential_problem_hypothesis: string | null
          promoted_prospect_id: string | null
          province: string | null
          qc_reason: string | null
          qc_reviewed_at: string | null
          qc_reviewed_by: string | null
          qc_reviewed_by_email: string | null
          qc_status: string
          qualified_at: string | null
          rating: number | null
          raw_payload: Json
          recommended_solution: string | null
          rejected_reason: string | null
          review_count: number | null
          review_requested_at: string | null
          sales_prepared_at: string | null
          sales_priority: string | null
          sales_stage: string
          screening_label: string | null
          source_keyword: string | null
          suggested_solution: string | null
          trust_breakdown: Json
          trust_score: number
          trust_tier: string
          updated_at: string
          validated_at: string | null
          validation_checks: Json
          validation_reason: string | null
          validation_status: string
          verification_checklist: Json
          verified_by: string | null
          verified_ready_at: string | null
          website: string | null
          website_status: string
          why_match_icp: string | null
        }
        Insert: {
          address?: string | null
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          auto_qc_reason?: string | null
          business_name: string
          business_name_normalized?: string | null
          buying_signal_hypothesis?: string | null
          campaign_id?: string | null
          candidate_status?: string
          category?: string | null
          city?: string | null
          confidence_score?: number | null
          contact_data?: Json
          contact_stage?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          digital_gap?: string | null
          discovery_method?: string
          discovery_query?: string | null
          discovery_reason?: string | null
          discovery_source?: string | null
          discovery_task_id?: string | null
          duplicate_confidence?: number | null
          duplicate_detected_at?: string | null
          duplicate_of?: string | null
          duplicate_reason?: string | null
          duplicate_status?: string
          google_maps_url?: string | null
          icp_reason?: string | null
          icp_score?: number
          id?: string
          industry?: string | null
          latitude?: number | null
          lead_reason?: string | null
          lead_score?: number
          lead_temperature?: string
          longitude?: number | null
          opening_hours?: Json
          pain_signal?: string | null
          permanently_closed?: boolean
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          potential_problem_hypothesis?: string | null
          promoted_prospect_id?: string | null
          province?: string | null
          qc_reason?: string | null
          qc_reviewed_at?: string | null
          qc_reviewed_by?: string | null
          qc_reviewed_by_email?: string | null
          qc_status?: string
          qualified_at?: string | null
          rating?: number | null
          raw_payload?: Json
          recommended_solution?: string | null
          rejected_reason?: string | null
          review_count?: number | null
          review_requested_at?: string | null
          sales_prepared_at?: string | null
          sales_priority?: string | null
          sales_stage?: string
          screening_label?: string | null
          source_keyword?: string | null
          suggested_solution?: string | null
          trust_breakdown?: Json
          trust_score?: number
          trust_tier?: string
          updated_at?: string
          validated_at?: string | null
          validation_checks?: Json
          validation_reason?: string | null
          validation_status?: string
          verification_checklist?: Json
          verified_by?: string | null
          verified_ready_at?: string | null
          website?: string | null
          website_status?: string
          why_match_icp?: string | null
        }
        Update: {
          address?: string | null
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          auto_qc_reason?: string | null
          business_name?: string
          business_name_normalized?: string | null
          buying_signal_hypothesis?: string | null
          campaign_id?: string | null
          candidate_status?: string
          category?: string | null
          city?: string | null
          confidence_score?: number | null
          contact_data?: Json
          contact_stage?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          digital_gap?: string | null
          discovery_method?: string
          discovery_query?: string | null
          discovery_reason?: string | null
          discovery_source?: string | null
          discovery_task_id?: string | null
          duplicate_confidence?: number | null
          duplicate_detected_at?: string | null
          duplicate_of?: string | null
          duplicate_reason?: string | null
          duplicate_status?: string
          google_maps_url?: string | null
          icp_reason?: string | null
          icp_score?: number
          id?: string
          industry?: string | null
          latitude?: number | null
          lead_reason?: string | null
          lead_score?: number
          lead_temperature?: string
          longitude?: number | null
          opening_hours?: Json
          pain_signal?: string | null
          permanently_closed?: boolean
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          potential_problem_hypothesis?: string | null
          promoted_prospect_id?: string | null
          province?: string | null
          qc_reason?: string | null
          qc_reviewed_at?: string | null
          qc_reviewed_by?: string | null
          qc_reviewed_by_email?: string | null
          qc_status?: string
          qualified_at?: string | null
          rating?: number | null
          raw_payload?: Json
          recommended_solution?: string | null
          rejected_reason?: string | null
          review_count?: number | null
          review_requested_at?: string | null
          sales_prepared_at?: string | null
          sales_priority?: string | null
          sales_stage?: string
          screening_label?: string | null
          source_keyword?: string | null
          suggested_solution?: string | null
          trust_breakdown?: Json
          trust_score?: number
          trust_tier?: string
          updated_at?: string
          validated_at?: string | null
          validation_checks?: Json
          validation_reason?: string | null
          validation_status?: string
          verification_checklist?: Json
          verified_by?: string | null
          verified_ready_at?: string | null
          website?: string | null
          website_status?: string
          why_match_icp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_candidates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospect_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_candidates_promoted_prospect_id_fkey"
            columns: ["promoted_prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_enrichments: {
        Row: {
          actor_name: string | null
          confidence_score: number
          created_at: string
          created_by: string | null
          dataset_id: string | null
          error_message: string | null
          id: string
          normalized_data: Json
          prospect_candidate_id: string | null
          prospect_id: string | null
          provider: string
          raw_payload: Json
          run_id: string | null
          source_type: string
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_name?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          normalized_data?: Json
          prospect_candidate_id?: string | null
          prospect_id?: string | null
          provider?: string
          raw_payload?: Json
          run_id?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_name?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          normalized_data?: Json
          prospect_candidate_id?: string | null
          prospect_id?: string | null
          provider?: string
          raw_payload?: Json
          run_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_enrichments_prospect_candidate_id_fkey"
            columns: ["prospect_candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_enrichments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_icp_config: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prospect_job_state: {
        Row: {
          detail: string | null
          key: string
          last_run_at: string | null
          last_status: string | null
          locked_at: string | null
          updated_at: string
        }
        Insert: {
          detail?: string | null
          key: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          updated_at?: string
        }
        Update: {
          detail?: string | null
          key?: string
          last_run_at?: string | null
          last_status?: string | null
          locked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospect_runs: {
        Row: {
          ai_calls: number
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          found_count: number
          id: string
          kind: string
          meta: Json
          query: string | null
          saved_count: number
          skipped_count: number
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          ai_calls?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          found_count?: number
          id?: string
          kind?: string
          meta?: Json
          query?: string | null
          saved_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Update: {
          ai_calls?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          found_count?: number
          id?: string
          kind?: string
          meta?: Json
          query?: string | null
          saved_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_name: string
          business_name_normalized: string | null
          business_problem: string | null
          business_profile: string | null
          business_summary: string | null
          buying_signal: string | null
          campaign_id: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          contact_whatsapp: string | null
          contacted_at: string | null
          converted_at: string | null
          country: string
          created_at: string
          created_by: string | null
          decision_maker: string | null
          discovery_query: string | null
          do_not_contact: boolean
          do_not_contact_reason: string | null
          duplicate_of: string | null
          email_source: string | null
          email_source_url: string | null
          evidence: Json
          fit_breakdown: Json
          fit_score: number
          fit_tier: string
          follow_up_count: number
          google_maps_url: string | null
          id: string
          industry: string | null
          industry_fit: string | null
          last_contact_at: string | null
          lead_id: string | null
          meta: Json
          next_follow_up_at: string | null
          notes: string | null
          opportunity_reason: string | null
          outreach_channel: string | null
          outreach_draft: string | null
          outreach_subject: string | null
          owner_name: string | null
          pain_signals: Json
          phone_source: string | null
          phone_source_url: string | null
          potential_need: string | null
          quality_gate: Json
          quality_gate_passed: boolean
          recommended_solution: string | null
          rejected_reason: string | null
          replied_at: string | null
          research_summary: string | null
          sales_approach: string | null
          sales_priority: string | null
          social_media: string | null
          social_source: string | null
          social_source_url: string | null
          source: string
          source_detail: string | null
          status: string
          status_updated_at: string
          trust_breakdown: Json
          trust_computed_at: string | null
          trust_score: number
          trust_tier: string
          updated_at: string
          validated_at: string | null
          validation_checks: Json
          validation_notes: string | null
          validation_score: number
          validation_stage: string
          verified: boolean
          verified_at: string | null
          website: string | null
          website_domain: string | null
          website_source: string | null
          website_source_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_name: string
          business_name_normalized?: string | null
          business_problem?: string | null
          business_profile?: string | null
          business_summary?: string | null
          buying_signal?: string | null
          campaign_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          contact_whatsapp?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          decision_maker?: string | null
          discovery_query?: string | null
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          duplicate_of?: string | null
          email_source?: string | null
          email_source_url?: string | null
          evidence?: Json
          fit_breakdown?: Json
          fit_score?: number
          fit_tier?: string
          follow_up_count?: number
          google_maps_url?: string | null
          id?: string
          industry?: string | null
          industry_fit?: string | null
          last_contact_at?: string | null
          lead_id?: string | null
          meta?: Json
          next_follow_up_at?: string | null
          notes?: string | null
          opportunity_reason?: string | null
          outreach_channel?: string | null
          outreach_draft?: string | null
          outreach_subject?: string | null
          owner_name?: string | null
          pain_signals?: Json
          phone_source?: string | null
          phone_source_url?: string | null
          potential_need?: string | null
          quality_gate?: Json
          quality_gate_passed?: boolean
          recommended_solution?: string | null
          rejected_reason?: string | null
          replied_at?: string | null
          research_summary?: string | null
          sales_approach?: string | null
          sales_priority?: string | null
          social_media?: string | null
          social_source?: string | null
          social_source_url?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          status_updated_at?: string
          trust_breakdown?: Json
          trust_computed_at?: string | null
          trust_score?: number
          trust_tier?: string
          updated_at?: string
          validated_at?: string | null
          validation_checks?: Json
          validation_notes?: string | null
          validation_score?: number
          validation_stage?: string
          verified?: boolean
          verified_at?: string | null
          website?: string | null
          website_domain?: string | null
          website_source?: string | null
          website_source_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_name?: string
          business_name_normalized?: string | null
          business_problem?: string | null
          business_profile?: string | null
          business_summary?: string | null
          buying_signal?: string | null
          campaign_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          contact_whatsapp?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          decision_maker?: string | null
          discovery_query?: string | null
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          duplicate_of?: string | null
          email_source?: string | null
          email_source_url?: string | null
          evidence?: Json
          fit_breakdown?: Json
          fit_score?: number
          fit_tier?: string
          follow_up_count?: number
          google_maps_url?: string | null
          id?: string
          industry?: string | null
          industry_fit?: string | null
          last_contact_at?: string | null
          lead_id?: string | null
          meta?: Json
          next_follow_up_at?: string | null
          notes?: string | null
          opportunity_reason?: string | null
          outreach_channel?: string | null
          outreach_draft?: string | null
          outreach_subject?: string | null
          owner_name?: string | null
          pain_signals?: Json
          phone_source?: string | null
          phone_source_url?: string | null
          potential_need?: string | null
          quality_gate?: Json
          quality_gate_passed?: boolean
          recommended_solution?: string | null
          rejected_reason?: string | null
          replied_at?: string | null
          research_summary?: string | null
          sales_approach?: string | null
          sales_priority?: string | null
          social_media?: string | null
          social_source?: string | null
          social_source_url?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          status_updated_at?: string
          trust_breakdown?: Json
          trust_computed_at?: string | null
          trust_score?: number
          trust_tier?: string
          updated_at?: string
          validated_at?: string | null
          validation_checks?: Json
          validation_notes?: string | null
          validation_score?: number
          validation_stage?: string
          verified?: boolean
          verified_at?: string | null
          website?: string | null
          website_domain?: string | null
          website_source?: string | null
          website_source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospect_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_preparations: {
        Row: {
          approach_category: string
          approach_reason: string | null
          business_brief: Json
          campaign_id: string | null
          candidate_id: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          evidence: Json
          generated_by: string
          id: string
          is_active: boolean
          outreach_message: Json
          prospect_id: string | null
          recommended_solution: string | null
          selected_asset: Json
          updated_at: string
        }
        Insert: {
          approach_category?: string
          approach_reason?: string | null
          business_brief?: Json
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          evidence?: Json
          generated_by?: string
          id?: string
          is_active?: boolean
          outreach_message?: Json
          prospect_id?: string | null
          recommended_solution?: string | null
          selected_asset?: Json
          updated_at?: string
        }
        Update: {
          approach_category?: string
          approach_reason?: string | null
          business_brief?: Json
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          evidence?: Json
          generated_by?: string
          id?: string
          is_active?: boolean
          outreach_message?: Json
          prospect_id?: string | null
          recommended_solution?: string | null
          selected_asset?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_preparations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospect_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_preparations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prospect_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_preparations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          task_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          task_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          capacity: number
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          notes: string | null
          role: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          capacity?: number
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          role?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          capacity?: number
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          role?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
    }
    Views: {
      lead_cta_performance: {
        Row: {
          clicks: number | null
          cta: string | null
        }
        Relationships: []
      }
      lead_monthly_trend: {
        Row: {
          avg_score: number | null
          leads: number | null
          month: string | null
        }
        Relationships: []
      }
      lead_product_interest: {
        Row: {
          product: string | null
          views: number | null
        }
        Relationships: []
      }
      lead_source_performance: {
        Row: {
          avg_score: number | null
          campaign: string | null
          hot_leads: number | null
          leads: number | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_dedupe_key: {
        Args: { _city: string; _country: string; _name: string }
        Returns: string
      }
      can_manage_business: { Args: { _user_id: string }; Returns: boolean }
      can_work_leads: { Args: { _user_id: string }; Returns: boolean }
      country_code: { Args: { _raw: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_access: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_business_name: { Args: { _raw: string }; Returns: string }
      run_ops_hook: { Args: { _path: string }; Returns: number }
      set_ops_cron_secret: { Args: { _value: string }; Returns: undefined }
      team_member_name: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff" | "user" | "owner" | "sales" | "viewer"
      business_analysis_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "stale"
      business_finding_kind: "fact" | "hypothesis"
      business_finding_validation:
        | "unvalidated"
        | "confirmed"
        | "rejected"
        | "superseded"
      business_legacy_type:
        | "prospect_candidate"
        | "prospect"
        | "consultation"
        | "ai_conversation"
        | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "user", "owner", "sales", "viewer"],
      business_analysis_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "stale",
      ],
      business_finding_kind: ["fact", "hypothesis"],
      business_finding_validation: [
        "unvalidated",
        "confirmed",
        "rejected",
        "superseded",
      ],
      business_legacy_type: [
        "prospect_candidate",
        "prospect",
        "consultation",
        "ai_conversation",
        "client",
      ],
    },
  },
} as const
