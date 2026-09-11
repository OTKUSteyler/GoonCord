import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { settings } from ".";

const { FormSection, FormRow, FormIcon, FormInput, FormSliderRow } = Forms;

export default function Settings() {
    useProxy(storage);

    return (
        <General.ScrollView style={{ flex: 1 }}>
            <FormSection title="Background">
                <FormRow
                    label="Image URL"
                    leading={<FormIcon source={getAssetIDByName("ic_image")} />}
                />
                <FormInput
                    title=""
                    keyboardType="url"
                    placeholder="https://link.to/background.png"
                    value={settings.backgroundUrl}
                    onChange={(x: string) => (settings.backgroundUrl = x)}
                    style={{ marginTop: -25, marginHorizontal: 12 }}
                />
                <FormSliderRow
                    label="Opacity"
                    value={settings.opacity ?? 0.3}
                    minimumValue={0}
                    maximumValue={1}
                    onValueChange={(v: number) => (settings.opacity = v)}
                />
                <FormSliderRow
                    label="Blur"
                    value={settings.blur ?? 0}
                    minimumValue={0}
                    maximumValue={25}
                    onValueChange={(v: number) => (settings.blur = v)}
                />
            </FormSection>
        </General.ScrollView>
    );
}
