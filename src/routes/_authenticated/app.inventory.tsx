      if (editingIngredient) {
        const { data, error } = await supabase
          .from("ingredients")
          .update(payload)
          .eq("id", editingIngredient)
          .eq("tenant_id", tenantId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error("لم يتم تعديل الخامة. تحقق من الصلاحيات.");
        }
      } else {
        const { data, error } = await supabase
          .from("ingredients")
          .insert({
            ...payload,
            tenant_id: tenantId,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("لم يتم تأكيد إضافة الخامة.");
        }
      }