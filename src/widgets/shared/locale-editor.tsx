import { Text } from 'ink';
import React, { useMemo } from 'react';

import type { WidgetEditorProps } from '../../types/Widget';
import {
    DEFAULT_RESET_LOCALE,
    canonicalizeLocale,
    filterLocaleOptions,
    getLocaleMatchSegments,
    getLocaleOptions
} from '../../utils/locales';

import { SearchableOptionEditor } from './searchable-option-editor';
import {
    getUsageLocale,
    setUsageLocale
} from './usage-display';

export const LOCALE_EDITOR_ACTION = 'edit-locale';

export function renderUsageLocaleEditor(props: WidgetEditorProps): React.ReactElement {
    return <UsageLocaleEditor {...props} />;
}

export const UsageLocaleEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel, action }) => {
    const currentLocale = getUsageLocale(widget);
    const options = useMemo(() => getLocaleOptions(currentLocale), [currentLocale]);

    if (action !== LOCALE_EDITOR_ACTION) {
        return <Text>未知编辑模式</Text>;
    }

    return (
        <SearchableOptionEditor
            title='地区设置'
            currentLabel={currentLocale ?? DEFAULT_RESET_LOCALE}
            initialValue={currentLocale ? canonicalizeLocale(currentLocale) : DEFAULT_RESET_LOCALE}
            options={options}
            filterOptions={filterLocaleOptions}
            getMatchSegments={getLocaleMatchSegments}
            emptyMessage='没有匹配的地区。'
            onSelect={(locale) => { onComplete(setUsageLocale(widget, locale)); }}
            onCancel={onCancel}
        />
    );
};
