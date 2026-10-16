import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../lib/theme";
import { Text } from "./ui";

export type SelectOption = { value: string; label: string; tag?: string };

// Dropdown styled like the website's season select (#1D1D1F, #BDC3C2 outline, 2px radius);
// the options open in a bottom sheet, which suits a phone better than a floating menu.
export function SelectSheet({
  value,
  options,
  onChange,
  title = "Select",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between active:opacity-80"
        style={{ backgroundColor: colors.uiPrimary, borderWidth: 1, borderColor: colors.textGrey, borderRadius: 2, paddingHorizontal: 16, paddingVertical: 12 }}
      >
        <Text className="text-sm text-greyscale-blue-300">{current?.label ?? "Select"}</Text>
        <ChevronDown size={16} color={colors.textGrey} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.sectionContainer, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: "70%", paddingBottom: insets.bottom + 8 }}>
            <Text className="px-6 pb-2 pt-5 font-brockmann-semibold text-base">{title}</Text>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex-row items-center px-6 py-4 ${o.value === value ? "bg-brand" : ""}`}
                >
                  <Text className="text-base">{o.label}</Text>
                  {!!o.tag && <Text className="ml-2 text-xs text-purple-300">· {o.tag}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
