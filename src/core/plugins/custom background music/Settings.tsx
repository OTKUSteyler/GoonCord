import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { settings, playFromUrl } from ".";

const { FormSection, FormRow, FormIcon, FormInput } = Forms;

export default function Settings() {
    useProxy(storage);

    return (
        <General.ScrollView style={{ flex: 1 }}>
            <FormSection title="Background Music">
                <FormRow
                    label="Music URL"
                    leading={<FormIcon source={getAssetIDByName("ic_link")} />}
                />
                <FormInput
                    title=""
                    keyboardType="url"
                    placeholder="https://link.to/music.mp3"
                    value={settings.url}
                    onChange={(x: string) => {
                        settings.url = x;
                        if (x) playFromUrl(x);
                    }}
                    style={{ marginTop: -25, marginHorizontal: 12 }}
                />
            </FormSection>
        </General.ScrollView>
    );
}
